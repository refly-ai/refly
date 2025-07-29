import { PrismaService } from '../common/prisma.service';
import { Injectable } from '@nestjs/common';
import { User, CreditBilling } from '@refly/openapi-schema';
import {
  CheckRequestCreditUsageResult,
  SyncTokenCreditUsageJobData,
  SyncMediaCreditUsageJobData,
} from './credit.dto';
import { genCreditUsageId, genCreditDebtId } from '@refly/utils';
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
          expiresAt: {
            gte: new Date(),
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

  /**
   * Deduct credits from user's recharge records and create usage record
   * If insufficient credits, create debt record instead of negative balance
   */
  private async deductCreditsAndCreateUsage(
    uid: string,
    creditCost: number,
    usageData: {
      usageId: string;
      actionResultId: string;
      modelName?: string;
      usageType?: string;
      createdAt: Date;
    },
  ): Promise<void> {
    // Get available credit recharge records ordered by expiresAt (oldest first)
    const creditRecharges = await this.prisma.creditRecharge.findMany({
      where: {
        uid,
        enabled: true,
        expiresAt: {
          gte: new Date(),
        },
        balance: {
          gt: 0,
        },
      },
      orderBy: {
        expiresAt: 'asc', // Deduct from earliest records first
      },
    });

    // Calculate total available credits
    const _totalAvailableCredits = creditRecharges.reduce((sum, record) => {
      return sum + record.balance;
    }, 0);

    // Prepare deduction operations
    const deductionOperations = [];
    let remainingCost = creditCost;

    // Deduct from available credits first
    for (const recharge of creditRecharges) {
      if (remainingCost <= 0) break;

      const deductAmount = Math.min(recharge.balance, remainingCost);
      const newBalance = recharge.balance - deductAmount;

      deductionOperations.push(
        this.prisma.creditRecharge.update({
          where: { pk: recharge.pk },
          data: { balance: newBalance },
        }),
      );

      remainingCost -= deductAmount;
    }

    // If there's still remaining cost, create a debt record
    const transactionOperations = [
      // Create credit usage record
      this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: usageData.usageId,
          actionResultId: usageData.actionResultId,
          modelName: usageData.modelName,
          usageType: usageData.usageType,
          amount: creditCost,
          createdAt: usageData.createdAt,
        },
      }),
      // Execute all deduction operations
      ...deductionOperations,
    ];

    // Add debt creation if needed
    if (remainingCost > 0) {
      transactionOperations.push(
        this.prisma.creditDebt.create({
          data: {
            debtId: genCreditDebtId(),
            uid,
            amount: remainingCost,
            balance: remainingCost,
            enabled: true,
            source: 'usage_overdraft',
            description: `Overdraft from usage: ${usageData.actionResultId}`,
            createdAt: usageData.createdAt,
            updatedAt: usageData.createdAt,
          },
        }),
      );
    }

    // Execute transaction
    await this.prisma.$transaction(transactionOperations);
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

    // Use the extracted method to handle credit deduction
    await this.deductCreditsAndCreateUsage(uid, creditCost, {
      usageId: genCreditUsageId(),
      actionResultId: resultId,
      modelName: usage.modelName,
      createdAt: timestamp,
    });
  }

  async syncMediaCreditUsage(data: SyncMediaCreditUsageJobData) {
    const { uid, creditBilling, timestamp, resultId } = data;

    // Find user
    const user = await this.prisma.user.findUnique({ where: { uid } });
    if (!user) {
      throw new Error(`No user found for uid ${uid}`);
    }

    // Calculate credit cost directly from unitCost
    const creditCost = creditBilling?.unitCost || 0;

    // If no credit cost, just create usage record
    if (creditCost <= 0) {
      await this.prisma.creditUsage.create({
        data: {
          uid,
          usageId: genCreditUsageId(),
          actionResultId: resultId,
          usageType: 'media_generation',
          amount: 0,
          createdAt: timestamp,
        },
      });
      return;
    }

    // Use the extracted method to handle credit deduction
    await this.deductCreditsAndCreateUsage(uid, creditCost, {
      usageId: genCreditUsageId(),
      actionResultId: resultId,
      usageType: 'media_generation',
      createdAt: timestamp,
    });
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

    // Query active debts
    const activeDebts = await this.prisma.creditDebt.findMany({
      where: {
        uid: user.uid,
        enabled: true,
        balance: {
          gt: 0,
        },
      },
      select: {
        balance: true,
      },
    });

    // Calculate total balance and total amount
    const totalBalance = activeRecharges.reduce((sum, record) => {
      return sum + Number(record.balance); // Convert BigInt to number
    }, 0);

    const totalAmount = activeRecharges.reduce((sum, record) => {
      return sum + Number(record.amount); // Convert BigInt to number
    }, 0);

    const totalDebt = activeDebts.reduce((sum, debt) => {
      return sum + Number(debt.balance);
    }, 0);

    // Net balance is positive balance minus debt
    const netBalance = totalBalance - totalDebt;

    return {
      creditAmount: totalAmount,
      creditBalance: netBalance,
    };
  }
}
