import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  guardianAgent,
  healthCheck,
  healthScorer,
  reportGenerator,
  vaccinationScheduler,
  vetAssistant,
} from '../../services/ai';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { AI_TAG } from '../../common/swagger/api-descriptions';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  GuardianAgentDto,
  HealthCheckDto,
  HealthScorerDto,
  ReportGeneratorDto,
  VaccinationSchedulerDto,
  VetAssistantDto,
} from './dto/ai.dto';

@ApiTags('AI')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  private async run<TInput, TResult>(
    endpoint: string,
    input: TInput,
    fn: (input: TInput) => Promise<TResult>,
  ): Promise<TResult> {
    const started = Date.now();
    try {
      const result = await fn(input);
      const ms = Date.now() - started;
      this.logger.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          endpoint,
          durationMs: ms,
          status: 'ok',
        }),
      );
      return result;
    } catch (err) {
      const ms = Date.now() - started;
      this.logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          endpoint,
          durationMs: ms,
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      throw new HttpException(
        'AI service failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('health-check')
  @ApiOperation({
    summary: 'AI disease triage from photo',
    description: `${AI_TAG}\n\nAnalyzes a base64 image for symptoms, possible diseases, urgency, and next steps.`,
  })
  diagnose(@Body() dto: HealthCheckDto) {
    return this.run('POST /ai/health-check', dto, healthCheck);
  }

  @Post('vet-assistant')
  @ApiOperation({
    summary: 'Multilingual AI vet chat',
    description: `${AI_TAG}\n\nLanguages: en, pcm (Pidgin), ha, yo, ig.`,
  })
  chat(@Body() dto: VetAssistantDto) {
    return this.run('POST /ai/vet-assistant', dto, vetAssistant);
  }

  @Post('guardian')
  @ApiOperation({
    summary: 'Outbreak detection from recent cases',
    description: `${AI_TAG}\n\nEpidemiology guardian — cluster analysis and recommended actions.`,
  })
  outbreak(@Body() dto: GuardianAgentDto) {
    return this.run('POST /ai/guardian', dto, guardianAgent);
  }

  @Post('health-score')
  @ApiOperation({
    summary: 'Animal health score (0–100)',
    description: `${AI_TAG}\n\nScores animal health from vaccinations, history, age, and location.`,
  })
  score(@Body() dto: HealthScorerDto) {
    return this.run('POST /ai/health-score', dto, healthScorer);
  }

  @Post('vaccination-schedule')
  @ApiOperation({
    summary: 'Predict next vaccination due dates',
    description: `${AI_TAG}\n\nNigerian schedules for cattle, goats, sheep, and poultry.`,
  })
  schedule(@Body() dto: VaccinationSchedulerDto) {
    return this.run('POST /ai/vaccination-schedule', dto, vaccinationScheduler);
  }

  @Post('report')
  @ApiOperation({
    summary: 'Generate disease surveillance report',
    description: `${AI_TAG}\n\nState-level Markdown report for government surveillance.`,
  })
  report(@Body() dto: ReportGeneratorDto) {
    return this.run('POST /ai/report', dto, reportGenerator);
  }
}
