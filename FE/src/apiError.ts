export type ApiErrorPayload = {
  code?: string;
  message?: string;
  statusCode?: number;
  details?: unknown;
  path?: string;
  timestamp?: string;
};

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(payload: ApiErrorPayload, fallbackStatus = 0) {
    const code = payload.code || codeForStatus(payload.statusCode ?? fallbackStatus);
    super(messageForCode(code, payload.message));
    this.name = "ApiError";
    this.code = code;
    this.statusCode = payload.statusCode ?? fallbackStatus;
    this.details = payload.details;
  }
}

export async function throwApiError(response: Response): Promise<never> {
  const text = await response.text();
  const payload = parseErrorPayload(text, response.status);
  throw new ApiError(payload, response.status);
}

export function getErrorMessage(error: unknown, fallback = "Có lỗi xảy ra. Vui lòng thử lại.") {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) {
    const payload = parseErrorPayload(error.message, 0);
    return payload.message ? messageForCode(payload.code, payload.message) : error.message;
  }
  return fallback;
}

export function getErrorCode(error: unknown) {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error) return parseErrorPayload(error.message, 0).code;
  return undefined;
}

function parseErrorPayload(text: string, statusCode: number): ApiErrorPayload {
  try {
    const parsed = JSON.parse(text) as ApiErrorPayload;
    if (parsed && typeof parsed === "object") {
      return {
        code: parsed.code,
        message: typeof parsed.message === "string" ? parsed.message : undefined,
        statusCode: parsed.statusCode ?? statusCode,
        details: parsed.details,
        path: parsed.path,
        timestamp: parsed.timestamp
      };
    }
  } catch {
    // Plain-text server response.
  }
  return {
    code: codeForStatus(statusCode),
    message: text || undefined,
    statusCode
  };
}

function codeForStatus(statusCode: number) {
  if (statusCode === 400) return "BAD_REQUEST";
  if (statusCode === 401) return "AUTH_REQUIRED";
  if (statusCode === 403) return "PERMISSION_DENIED";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 409) return "CONFLICT";
  if (statusCode === 429) return "RATE_LIMITED";
  if (statusCode >= 500) return "INTERNAL_SERVER_ERROR";
  return "REQUEST_FAILED";
}

function messageForCode(code = "REQUEST_FAILED", serverMessage?: string) {
  const messages: Record<string, string> = {
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
    INTERNAL_SERVER_ERROR: "Hệ thống đang gặp lỗi. Vui lòng thử lại sau.",
    AUTH_REQUIRED: "Bạn cần đăng nhập để tiếp tục.",
    REQUEST_FAILED: "Yêu cầu không thực hiện được. Vui lòng thử lại."
  };

  return serverMessage || messages[code] || messages.REQUEST_FAILED;
}
