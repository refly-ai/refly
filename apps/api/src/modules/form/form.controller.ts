import { Controller, Get, Post, UseGuards, Body } from '@nestjs/common';
import { FormService } from './form.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import {
  User,
  SubmitFormRequest,
  GetFormDefinitionResponse,
  SubmitFormResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';

@Controller('v1/form')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @UseGuards(JwtAuthGuard)
  @Get('/definition')
  async getFormDefinition(@LoginedUser() user: User): Promise<GetFormDefinitionResponse> {
    const formDefinition = await this.formService.getFormDefinition(user.uid);
    return buildSuccessResponse(formDefinition);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/submission')
  async submitForm(
    @LoginedUser() user: User,
    @Body() body: SubmitFormRequest,
  ): Promise<SubmitFormResponse> {
    await this.formService.submitForm(user.uid, body.formSubmission);
    return buildSuccessResponse();
  }
}
