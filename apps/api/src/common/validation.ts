import { ValidationError } from "class-validator";
import { AppError, type FieldError } from "./app-error";

export function validationException(errors: ValidationError[]): AppError {
  return new AppError("VALIDATION_FAILED", "Dữ liệu không hợp lệ", flatten(errors));
}

function flatten(errors: ValidationError[], prefix = ""): FieldError[] {
  const details: FieldError[] = [];
  for (const error of errors) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    const message = fieldMessage(error);
    if (message) details.push({ field, message });
    if (error.children?.length) details.push(...flatten(error.children, field));
  }
  return details;
}

function fieldMessage(error: ValidationError): string | undefined {
  if (!error.constraints) return undefined;
  if (error.constraints.whitelistValidation) return "Không được gửi trường này";
  return Object.values(error.constraints)[0];
}
