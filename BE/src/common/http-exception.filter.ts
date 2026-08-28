import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";
import { API_ERROR_CODES, ApiErrorCode } from "./api-error-codes";

type ErrorBody = {
  code: ApiErrorCode;
  message: string;
  statusCode: number;
  path: string;
  timestamp: string;
  details?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const normalized = this.normalize(exception);

    if (normalized.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} failed with ${normalized.code}: ${normalized.message}`,
        exception instanceof Error ? exception.stack : undefined
      );
    }

    const body: ErrorBody = {
      code: normalized.code,
      message: normalized.message,
      statusCode: normalized.statusCode,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(normalized.details === undefined ? {} : { details: normalized.details })
    };

    response.status(normalized.statusCode).json(body);
  }

  private normalize(exception: unknown): { statusCode: number; code: ApiErrorCode; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const extracted = this.extractHttpResponse(response, exception.message);
      const code = this.codeFor(statusCode, extracted.message);
      return {
        statusCode,
        code,
        message: this.publicMessage(code, statusCode, extracted.message),
        details: extracted.details
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return {
          statusCode: HttpStatus.CONFLICT,
          code: API_ERROR_CODES.CONFLICT,
          message: "Dữ liệu đã tồn tại, vui lòng kiểm tra lại.",
          details: { target: exception.meta?.target }
        };
      }
      if (exception.code === "P2025") {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Không tìm thấy dữ liệu cần thao tác."
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Hệ thống đang gặp lỗi. Vui lòng thử lại sau."
    };
  }

  private extractHttpResponse(response: string | object, fallbackMessage: string) {
    if (typeof response === "string") {
      return { message: response };
    }

    const record = response as Record<string, unknown>;
    const rawMessage = record.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.filter((item): item is string => typeof item === "string").join("; ")
      : typeof rawMessage === "string"
        ? rawMessage
        : fallbackMessage;

    return {
      message,
      details: Array.isArray(rawMessage) ? rawMessage : record.details
    };
  }

  private codeFor(statusCode: number, message: string): ApiErrorCode {
    const normalized = this.normalizeMessage(message);

    if (normalized.includes("missing access token")) return API_ERROR_CODES.AUTH_MISSING_ACCESS_TOKEN;
    if (normalized.includes("access token expired")) return API_ERROR_CODES.AUTH_ACCESS_TOKEN_EXPIRED;
    if (normalized.includes("invalid access token")) return API_ERROR_CODES.AUTH_INVALID_ACCESS_TOKEN;
    if (normalized.includes("missing refresh token")) return API_ERROR_CODES.AUTH_MISSING_REFRESH_TOKEN;
    if (normalized.includes("refresh session is invalid")) return API_ERROR_CODES.AUTH_INVALID_REFRESH_SESSION;
    if (normalized.includes("email hoặc mật khẩu không chính xác") || normalized.includes("integrated auth rejected credentials")) {
      return API_ERROR_CODES.AUTH_INVALID_CREDENTIALS;
    }
    if (normalized.includes("user not found")) return API_ERROR_CODES.AUTH_USER_NOT_FOUND;
    if (normalized.includes("tài khoản đã bị vô hiệu hóa")) return API_ERROR_CODES.AUTH_ACCOUNT_DISABLED;
    if (normalized.includes("tài khoản đang bị khóa")) return API_ERROR_CODES.AUTH_ACCOUNT_LOCKED;
    if (normalized.includes("token không hợp lệ hoặc đã hết hạn")) return API_ERROR_CODES.AUTH_TOKEN_INVALID_OR_EXPIRED;

    if (normalized.includes("bạn không có quyền trên tài liệu")) return API_ERROR_CODES.DOCUMENT_PERMISSION_DENIED;
    if (normalized.includes("bạn không có quyền") || statusCode === HttpStatus.FORBIDDEN) return API_ERROR_CODES.PERMISSION_DENIED;
    if (normalized.includes("project not found")) return API_ERROR_CODES.PROJECT_NOT_FOUND;
    if (normalized.includes("mã dự án đã tồn tại")) return API_ERROR_CODES.PROJECT_CODE_EXISTS;
    if (normalized.includes("document version not found")) return API_ERROR_CODES.DOCUMENT_VERSION_NOT_FOUND;
    if (normalized.includes("document not found")) return API_ERROR_CODES.DOCUMENT_NOT_FOUND;
    if (normalized.includes("work item comment not found")) return API_ERROR_CODES.WORK_ITEM_COMMENT_NOT_FOUND;
    if (normalized.includes("work item not found")) return API_ERROR_CODES.WORK_ITEM_NOT_FOUND;
    if (normalized.includes("comment not found")) return API_ERROR_CODES.COMMENT_NOT_FOUND;
    if (normalized.includes("chỉ có thể sửa") || normalized.includes("chỉ có thể xóa")) return API_ERROR_CODES.COMMENT_CHANGE_FORBIDDEN;
    if (normalized.includes("không thể xóa comment này vì đang có reply")) return API_ERROR_CODES.COMMENT_DELETE_BLOCKED;
    if (normalized.includes("người phụ trách phải là thành viên")) return API_ERROR_CODES.WORK_ITEM_ASSIGNMENT_INVALID;
    if (normalized.includes("workboard column not found")) return API_ERROR_CODES.WORKBOARD_COLUMN_NOT_FOUND;
    if (normalized.includes("không thể xóa cột")) return API_ERROR_CODES.WORKBOARD_COLUMN_DELETE_BLOCKED;
    if (normalized.includes("email này đã") || normalized.includes("email này đã được đăng ký")) return API_ERROR_CODES.USER_EMAIL_EXISTS;
    if (normalized.includes("file is required")) return API_ERROR_CODES.FILE_REQUIRED;
    if (normalized.includes("only .md") || normalized.includes("files are supported")) return API_ERROR_CODES.FILE_TYPE_UNSUPPORTED;
    if (normalized.includes("không đọc được") || normalized.includes("không render được") || normalized.includes("không convert được")) {
      return API_ERROR_CODES.IMPORT_PARSE_FAILED;
    }
    if (normalized.includes("media asset not found")) return API_ERROR_CODES.MEDIA_NOT_FOUND;
    if (normalized.includes("template not found")) return API_ERROR_CODES.TEMPLATE_NOT_FOUND;
    if (normalized.includes("requirement tag not found")) return API_ERROR_CODES.REQUIREMENT_TAG_NOT_FOUND;
    if (normalized.includes("trace link not found")) return API_ERROR_CODES.TRACE_LINK_NOT_FOUND;
    if (
      statusCode === HttpStatus.UNPROCESSABLE_ENTITY
      || normalized.includes("dữ liệu gửi lên không hợp lệ")
      || normalized.includes("property ")
      || normalized.includes("must ")
    ) {
      return API_ERROR_CODES.VALIDATION_FAILED;
    }

    if (statusCode === HttpStatus.BAD_REQUEST) return API_ERROR_CODES.BAD_REQUEST;
    if (statusCode === HttpStatus.NOT_FOUND) return API_ERROR_CODES.NOT_FOUND;
    if (statusCode === HttpStatus.CONFLICT) return API_ERROR_CODES.CONFLICT;
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) return API_ERROR_CODES.RATE_LIMITED;
    return API_ERROR_CODES.INTERNAL_SERVER_ERROR;
  }

  private publicMessage(code: ApiErrorCode, statusCode: number, message: string) {
    const normalized = this.normalizeMessage(message);
    const publicMessages: Partial<Record<ApiErrorCode, string>> = {
      AUTH_MISSING_ACCESS_TOKEN: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
      AUTH_ACCESS_TOKEN_EXPIRED: "Phiên đăng nhập đã hết hạn. Hệ thống sẽ thử làm mới phiên.",
      AUTH_INVALID_ACCESS_TOKEN: "Token đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
      AUTH_MISSING_REFRESH_TOKEN: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      AUTH_INVALID_REFRESH_SESSION: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không chính xác.",
      AUTH_USER_NOT_FOUND: "Không tìm thấy tài khoản này.",
      AUTH_ACCOUNT_DISABLED: "Tài khoản đã bị vô hiệu hóa.",
      AUTH_ACCOUNT_LOCKED: "Tài khoản đang bị khóa tạm thời.",
      AUTH_TOKEN_INVALID_OR_EXPIRED: "Mã xác thực không hợp lệ hoặc đã hết hạn.",
      PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này.",
      DOCUMENT_PERMISSION_DENIED: "Bạn không có quyền truy cập tài liệu này.",
      PROJECT_NOT_FOUND: "Không tìm thấy dự án.",
      PROJECT_CODE_EXISTS: "Mã dự án đã tồn tại, vui lòng thử mã khác.",
      DOCUMENT_NOT_FOUND: "Không tìm thấy tài liệu.",
      DOCUMENT_VERSION_NOT_FOUND: "Không tìm thấy phiên bản tài liệu.",
      COMMENT_NOT_FOUND: "Không tìm thấy nhận xét.",
      COMMENT_CHANGE_FORBIDDEN: "Bạn chỉ có thể sửa hoặc xóa nhận xét của chính mình.",
      COMMENT_DELETE_BLOCKED: "Không thể xóa nhận xét này vì đang có reply của người khác.",
      WORK_ITEM_NOT_FOUND: "Không tìm thấy ticket.",
      WORK_ITEM_COMMENT_NOT_FOUND: "Không tìm thấy comment ticket.",
      WORK_ITEM_ASSIGNMENT_INVALID: "Người phụ trách phải là thành viên dự án hoặc có quyền trên tài liệu liên quan.",
      WORKBOARD_COLUMN_NOT_FOUND: "Không tìm thấy cột Workboard.",
      WORKBOARD_COLUMN_DELETE_BLOCKED: "Không thể xóa cột này vì đang có ticket hoặc là cột cuối cùng.",
      USER_NOT_FOUND: "Không tìm thấy người dùng.",
      USER_EMAIL_EXISTS: "Email này đã tồn tại.",
      FILE_REQUIRED: "Vui lòng chọn file trước khi tải lên.",
      FILE_TYPE_UNSUPPORTED: "Định dạng file chưa được hỗ trợ.",
      IMPORT_PARSE_FAILED: "Không đọc được nội dung file. Vui lòng kiểm tra định dạng hoặc thử file khác.",
      MEDIA_NOT_FOUND: "Không tìm thấy file media.",
      TEMPLATE_NOT_FOUND: "Không tìm thấy mẫu tài liệu.",
      REQUIREMENT_TAG_NOT_FOUND: "Không tìm thấy tag yêu cầu.",
      TRACE_LINK_NOT_FOUND: "Không tìm thấy liên kết truy vết.",
      VALIDATION_FAILED: "Dữ liệu gửi lên không hợp lệ. Vui lòng kiểm tra lại.",
      BAD_REQUEST: "Yêu cầu không hợp lệ. Vui lòng kiểm tra lại.",
      NOT_FOUND: "Không tìm thấy dữ liệu cần thao tác.",
      CONFLICT: "Dữ liệu đã tồn tại hoặc đang xung đột.",
      RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      INTERNAL_SERVER_ERROR: "Hệ thống đang gặp lỗi. Vui lòng thử lại sau."
    };

    if (statusCode >= 500) return "Hệ thống đang gặp lỗi. Vui lòng thử lại sau.";
    if (message.includes("No ") && message.includes(" fields to update")) return "Không có thay đổi nào để lưu.";
    return publicMessages[code] || message || "Yêu cầu không thực hiện được. Vui lòng thử lại.";
  }

  private normalizeMessage(message: string) {
    return message
      .normalize("NFC")
      .toLocaleLowerCase("vi-VN")
      .replace(/\s+/g, " ")
      .trim();
  }
}
