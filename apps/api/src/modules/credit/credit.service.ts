import { PrismaService } from '../common/prisma.service';
import { Injectable } from '@nestjs/common';
import { User, CreditBilling } from '@refly/openapi-schema';
import { CheckRequestCreditUsageResult, SyncTokenCreditUsageJobData } from './credit.dto';
import { genCreditUsageId } from '@refly/utils';
import { CreditRecharge, CreditUsage } from '@refly/openapi-schema';
import { CreditBalance } from './credit.dto';

@Injectable()
export class CreditService {
  constructor(protected readonly prisma: PrismaService) {}

  async checkRequestCreditUsage(
    user: User,
    creditBilling: CreditBilling,
  ): Promise<CheckRequestCreditUsageResult> {
    const result: CheckRequestCreditUsageResult = {
      canUse: false,
      message: '',
    };

    try {
      // Query all active credit recharge records for the user
      const creditRecharges = await this.prisma.creditRecharge.findMany({
        where: {
          uid: user.uid,
          enabled: true,
          balance: {
            gt: 0, // Only records with positive balance
          },
        },
        orderBy: {
          createdAt: 'asc', // Order by creation time (oldest first)
        },
      });

      // Calculate total available credit balance
      const totalBalance = creditRecharges.reduce((sum, record) => {
        return sum + record.balance;
      }, 0);

      // Check if total balance is greater than minimum charge
      const minCharge = creditBilling.minCharge;

      if (totalBalance >= minCharge) {
        result.canUse = true;
        result.message = `Available credits: ${totalBalance}, Required minimum: ${minCharge}`;
      } else {
        result.canUse = false;
        result.message = `Insufficient credits. Available: ${totalBalance}, Required minimum: ${minCharge}`;
      }
    } catch (error) {
      result.canUse = false;
      result.message = `Error checking credit balance: ${error.message}`;
    }
    return result;
  }

  async syncTokenCreditUsage(data: SyncTokenCreditUsageJobData) {
    const { uid, usage, creditBilling, timestamp, resultId } = data;

    // Find user
    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      throw new Error(`No user found for uid ${uid}`);
    }

    // Calculate total tokens used
    const totalTokens = usage.inputTokens + usage.outputTokens;

    // Calculate credit cost based on unit (5k_tokens)
    let creditCost = 0;
    if (creditBilling && creditBilling.unit === '5k_tokens') {
      // Round up to nearest 5k tokens (not enough 5K counts as 5K)
      const tokenUnits = Math.ceil(totalTokens / 5000);
      creditCost = tokenUnits * (creditBilling.unitCost || 0);
    }

    // If no credit cost, just create usage record
    if (creditCost <= 0) {
      await this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: genCreditUsageId(),
          actionResultId: resultId,
          modelName: usage.modelName,
          amount: 0,
          createdAt: timestamp,
        },
      });
      return;
    }

    // Get available credit recharge records ordered by createdAt (oldest first)
    const creditRecharges = await this.prisma.creditRecharge.findMany({
      where: {
        uid,
        enabled: true,
        balance: {
          gt: 0,
        },
      },
      orderBy: {
        expiresAt: 'asc', // Deduct from earliest records first
      },
    });

    // Prepare deduction operations
    const deductionOperations = [];
    let remainingCost = creditCost;

    for (let i = 0; i < creditRecharges.length; i++) {
      const recharge = creditRecharges[i];
      if (remainingCost <= 0) break;

      let deductAmount: number;
      let newBalance: number;

      // If this is the last record, deduct all remaining cost even if it goes negative
      if (i === creditRecharges.length - 1) {
        deductAmount = remainingCost;
        newBalance = recharge.balance - deductAmount;
      } else {
        // For non-last records, only deduct up to available balance
        deductAmount = Math.min(recharge.balance, remainingCost);
        newBalance = recharge.balance - deductAmount;
      }

      deductionOperations.push(
        this.prisma.creditRecharge.update({
          where: { pk: recharge.pk },
          data: { balance: newBalance },
        }),
      );

      remainingCost -= deductAmount;
    }

    // Execute transaction: create usage record and deduct credits
    await this.prisma.$transaction([
      // Create credit usage record
      this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: genCreditUsageId(),
          actionResultId: resultId,
          modelName: usage.modelName,
          amount: creditCost,
          createdAt: timestamp,
        },
      }),
      // Execute all deduction operations
      ...deductionOperations,
    ]);
  }

  async getCreditRecharge(user: User): Promise<CreditRecharge[]> {
    const records = await this.prisma.creditRecharge.findMany({
      where: {
        uid: user.uid,
      },
      select: {
        rechargeId: true,
        uid: true,
        amount: true,
        balance: true,
        enabled: true,
        source: true,
        description: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return records.map((record) => ({
      ...record,
      amount: Number(record.amount), // Convert BigInt to number
      balance: Number(record.balance), // Convert BigInt to number
      source: record.source as 'purchase' | 'gift' | 'promotion' | 'refund',
      expiresAt: record.expiresAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
  }

  async getCreditUsage(user: User): Promise<CreditUsage[]> {
    const records = await this.prisma.creditUsage.findMany({
      where: {
        uid: user.uid,
      },
      select: {
        usageId: true,
        uid: true,
        amount: true,
        providerItemId: true,
        modelName: true,
        usageType: true,
        actionResultId: true,
        pilotSessionId: true,
        description: true,
        createdAt: true,
      },
    });
    return records.map((record) => ({
      ...record,
      amount: Number(record.amount), // Convert BigInt to number
      usageType: record.usageType as
        | 'model_call'
        | 'media_generation'
        | 'embedding'
        | 'reranking'
        | 'other',
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async getCreditBalance(user: User): Promise<CreditBalance> {
    // Query all active (unexpired) credit recharge records
    const activeRecharges = await this.prisma.creditRecharge.findMany({
      where: {
        uid: user.uid,
        enabled: true,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      select: {
        amount: true,
        balance: true,
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });

    // Calculate total balance and total amount
    const totalBalance = activeRecharges.reduce((sum, record) => {
      return sum + Number(record.balance); // Convert BigInt to number
    }, 0);

    const totalAmount = activeRecharges.reduce((sum, record) => {
      return sum + Number(record.amount); // Convert BigInt to number
    }, 0);

    return {
      creditAmount: totalAmount,
      creditBalance: totalBalance, // 修复字段名以匹配OpenAPI schema
    };
  }
}
