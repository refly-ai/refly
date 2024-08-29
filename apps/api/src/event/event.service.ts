import { Injectable, Logger } from '@nestjs/common';
import { SimpleEventData } from '@/event/event.dto';
import { PrismaService } from '@/common/prisma.service';
import { SkillContext } from '@refly/openapi-schema';
import { SkillService } from '@/skill/skill.service';
import { SkillTrigger } from '@prisma/client';

@Injectable()
export class EventService {
  private logger = new Logger(EventService.name);

  constructor(private prisma: PrismaService, private skillService: SkillService) {}

  async handleSimpleEvent(data: SimpleEventData) {
    const { uid, entityType, entityId, name } = data;
    const user = await this.prisma.user.findFirst({ where: { uid } });

    if (!user) {
      this.logger.warn(`user ${uid} not found, skip handle event`);
      return;
    }

    const triggers = await this.prisma.skillTrigger.findMany({
      where: {
        uid,
        triggerType: 'simpleEvent',
        simpleEventName: name,
        enabled: true,
        deletedAt: null,
      },
    });

    if (triggers.length > 0) {
      const skillContext: SkillContext = {};
      if (entityType === 'collection') {
        skillContext.collectionIds = [entityId];
      } else if (entityType === 'resource') {
        skillContext.resourceIds = [entityId];
      } else if (entityType === 'note') {
        skillContext.noteIds = [entityId];
      }

      const skills = await this.prisma.skillInstance.findMany({
        where: { skillId: { in: triggers.map((trigger) => trigger.skillId) } },
      });
      const skillToTriggerMap = new Map<string, SkillTrigger>(
        triggers.map((trigger) => [trigger.skillId, trigger]),
      );

      await Promise.all(
        skills.map((skill) => {
          const trigger = skillToTriggerMap.get(skill.skillId);

          return this.skillService.sendInvokeSkillTask(user, {
            input: JSON.parse(trigger.input ?? '{}'),
            skillId: skill.skillId,
            context: skillContext,
            triggerId: trigger.triggerId,
            tplConfig: JSON.parse(trigger.tplConfig || '{}'),
          });
        }),
      );
    }
  }
}
