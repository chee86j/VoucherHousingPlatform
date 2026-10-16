import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DocumentStatus } from '@vhp/database';

export class RegisterDocumentDto {
  @IsString() @MaxLength(128)
  clientId!: string;

  @IsOptional() @IsString() @MaxLength(128)
  caseId?: string;

  @IsOptional() @IsString() @MaxLength(128)
  checklistItemId?: string;

  @IsString() @MaxLength(180)
  fileName!: string;

  @IsString() @MaxLength(80)
  mimeType!: string;

  @IsInt() @Min(1) @Max(15 * 1024 * 1024)
  sizeBytes!: number;

  @IsString() @Matches(/^[a-f0-9]{64}$/i)
  sha256!: string;

}

export class DocumentIdParamDto {
  @IsString() @MaxLength(128) @Matches(/^c[a-z0-9]{24}$/)
  id!: string;
}

export class ReviewDocumentDto {
  @IsEnum(DocumentStatus)
  status!: DocumentStatus;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
