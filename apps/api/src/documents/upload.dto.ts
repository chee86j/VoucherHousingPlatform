import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadDocumentBodyDto {
  @IsString() @MaxLength(128)
  clientId!: string;

  @IsOptional() @IsString() @MaxLength(128)
  caseId?: string;

  @IsOptional() @IsString() @MaxLength(128)
  checklistItemId?: string;

  @IsOptional() @IsString() @MaxLength(180)
  fileName?: string;
}
