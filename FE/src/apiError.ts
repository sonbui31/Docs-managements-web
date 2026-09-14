import i18n from "./i18n";

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

export function getErrorMessage(error: unknown, fallback = i18n.language === "en" ? "An error occurred. Please try again." : "Có lỗi xảy ra. Vui lòng thử lại.") {
  const lang = i18n.language || "vi";
  if (error instanceof ApiError) return messageForCode(error.code, error.message, lang);
  if (error instanceof Error) {
    const payload = parseErrorPayload(error.message, 0);
    return payload.message ? messageForCode(payload.code, payload.message, lang) : translateText(error.message, lang);
  }
  return translateText(fallback, lang);
}

export function getErrorCode(error: unknown) {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error) return parseErrorPayload(error.message, 0).code;
  return undefined;
}

export function translateText(text: string, lang = i18n.language): string {
  if (!text || lang !== "en") return text;
  return textTranslationMap[text.trim()] || translateByKeywords(text);
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

function messageForCode(code = "REQUEST_FAILED", serverMessage?: string, lang = i18n.language) {
  const isEn = lang === "en";
  const messagesVi: Record<string, string> = {
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
    COMMENT_DELETE_BLOCKED: "Không thể xóa nhận xét này vì đang có trả lời của người khác.",
    WORK_ITEM_NOT_FOUND: "Không tìm thấy ticket.",
    WORK_ITEM_COMMENT_NOT_FOUND: "Không tìm thấy comment ticket.",
    WORK_ITEM_ASSIGNMENT_INVALID: "Người phụ trách phải là thành viên dự án hoặc có quyền trên tài liệu liên quan.",
    WORKBOARD_COLUMN_NOT_FOUND: "Không tìm thấy cột Workboard.",
    WORKBOARD_COLUMN_DELETE_BLOCKED: "Không thể xóa cột này vì đang có ticket hoặc là cột cuối cùng.",
    USER_NOT_FOUND: "Không tìm thấy người dùng.",
    USER_EMAIL_EXISTS: "Email này đã tồn tại.",
    FILE_REQUIRED: "Vui lòng chọn file trước khi tải lên.",
    FILE_TOO_LARGE: "File quá lớn. Vui lòng chọn file nhỏ hơn.",
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

  const messagesEn: Record<string, string> = {
    AUTH_MISSING_ACCESS_TOKEN: "Invalid login session. Please sign in again.",
    AUTH_ACCESS_TOKEN_EXPIRED: "Session expired. Attempting to refresh session.",
    AUTH_INVALID_ACCESS_TOKEN: "Invalid login token. Please sign in again.",
    AUTH_MISSING_REFRESH_TOKEN: "Session expired. Please sign in again.",
    AUTH_INVALID_REFRESH_SESSION: "Session expired. Please sign in again.",
    AUTH_INVALID_CREDENTIALS: "Invalid email or password.",
    AUTH_USER_NOT_FOUND: "User account not found.",
    AUTH_ACCOUNT_DISABLED: "This account has been disabled.",
    AUTH_ACCOUNT_LOCKED: "This account is temporarily locked.",
    AUTH_TOKEN_INVALID_OR_EXPIRED: "Verification code is invalid or expired.",
    PERMISSION_DENIED: "You do not have permission to perform this action.",
    DOCUMENT_PERMISSION_DENIED: "You do not have permission to access this document.",
    PROJECT_NOT_FOUND: "Project not found.",
    PROJECT_CODE_EXISTS: "Project code already exists, please choose another code.",
    DOCUMENT_NOT_FOUND: "Document not found.",
    DOCUMENT_VERSION_NOT_FOUND: "Document version not found.",
    COMMENT_NOT_FOUND: "Comment not found.",
    COMMENT_CHANGE_FORBIDDEN: "You can only edit or delete your own comments.",
    COMMENT_DELETE_BLOCKED: "Cannot delete this comment because it has replies from others.",
    WORK_ITEM_NOT_FOUND: "Ticket not found.",
    WORK_ITEM_COMMENT_NOT_FOUND: "Ticket comment not found.",
    WORK_ITEM_ASSIGNMENT_INVALID: "Assignee must be a project member or have document permission.",
    WORKBOARD_COLUMN_NOT_FOUND: "Workboard column not found.",
    WORKBOARD_COLUMN_DELETE_BLOCKED: "Cannot delete this column because it has tickets or is the last column.",
    USER_NOT_FOUND: "User not found.",
    USER_EMAIL_EXISTS: "This email is already registered.",
    FILE_REQUIRED: "Please select a file before uploading.",
    FILE_TOO_LARGE: "File size is too large. Please select a smaller file.",
    FILE_TYPE_UNSUPPORTED: "File format is not supported.",
    IMPORT_PARSE_FAILED: "Failed to read file content. Please check file format or try another file.",
    MEDIA_NOT_FOUND: "Media file not found.",
    TEMPLATE_NOT_FOUND: "Document template not found.",
    REQUIREMENT_TAG_NOT_FOUND: "Requirement tag not found.",
    TRACE_LINK_NOT_FOUND: "Traceability link not found.",
    VALIDATION_FAILED: "Submitted data is invalid. Please double check.",
    BAD_REQUEST: "Invalid request. Please check and try again.",
    NOT_FOUND: "Requested resource not found.",
    CONFLICT: "Data already exists or conflicts.",
    RATE_LIMITED: "Too many requests. Please try again later.",
    INTERNAL_SERVER_ERROR: "Internal server error. Please try again later.",
    AUTH_REQUIRED: "Authentication required. Please sign in to continue.",
    REQUEST_FAILED: "Request failed. Please try again."
  };

  const dict = isEn ? messagesEn : messagesVi;
  if (serverMessage) {
    return isEn ? translateText(serverMessage, "en") : serverMessage;
  }
  return dict[code] || dict.REQUEST_FAILED;
}

function translateByKeywords(text: string): string {
  let s = text;
  s = s.replace(/Không tìm thấy/g, "Could not find");
  s = s.replace(/Không mở được/g, "Could not open");
  s = s.replace(/Không lưu được/g, "Could not save");
  s = s.replace(/Không xóa được/g, "Could not delete");
  s = s.replace(/Không tạo được/g, "Could not create");
  s = s.replace(/Không sửa được/g, "Could not edit");
  s = s.replace(/Không cập nhật được/g, "Could not update");
  s = s.replace(/Không upload được/g, "Could not upload");
  s = s.replace(/Không xuất được/g, "Could not export");
  s = s.replace(/Không tải được/g, "Could not load");
  s = s.replace(/Không gửi được/g, "Could not send");
  s = s.replace(/Không chuyển được/g, "Could not change");
  s = s.replace(/Có lỗi xảy ra\. Vui lòng thử lại\./g, "An error occurred. Please try again.");
  s = s.replace(/Vui lòng kiểm tra/g, "Please check");
  s = s.replace(/hoặc thử lại/g, "or try again");
  s = s.replace(/chưa lưu được/g, "could not save");
  s = s.replace(/chưa cập nhật được/g, "could not update");
  s = s.replace(/chưa tạo được/g, "could not create");
  s = s.replace(/chưa xóa được/g, "could not delete");
  return s;
}

const textTranslationMap: Record<string, string> = {
  "Có lỗi xảy ra. Vui lòng thử lại.": "An error occurred. Please try again.",
  "Không mở được ticket": "Could not open ticket",
  "Phiên sửa đã bị ngắt": "Edit session interrupted",
  "Không mở được chế độ sửa": "Could not open edit mode",
  "Không đổi được trạng thái": "Could not change status",
  "Không lưu được board": "Could not save board",
  "Không tải được comment": "Could not load comments",
  "Không gửi được comment": "Could not post comment",
  "Không sửa được comment": "Could not edit comment",
  "Không xóa được comment": "Could not delete comment",
  "Không upload được file": "Could not upload file",
  "Không lưu được ticket": "Could not save ticket",
  "Không duplicate được ticket": "Could not duplicate ticket",
  "Không xóa được ticket": "Could not delete ticket",
  "Không tạo được dự án": "Could not create project",
  "Không cập nhật được dự án": "Could not update project",
  "Không xóa được dự án": "Could not delete project",
  "Không tạo được tài liệu": "Could not create document",
  "Không cập nhật được tài liệu": "Could not update document",
  "Không chuyển được trạng thái": "Could not change status",
  "Không xóa được tài liệu": "Could not delete document",
  "Không xóa được nhận xét": "Could not delete comment",
  "Import thất bại": "Import failed",
  "Không tải được lịch sử phiên bản": "Could not load version history",
  "Không tạo được phiên bản": "Could not create version",
  "Không khôi phục được phiên bản": "Could not restore version",
  "Không lưu được tag": "Could not save tag",
  "Không xóa được tag": "Could not delete tag",
  "Không tạo được truy vết": "Could not create trace link",
  "Không xóa được truy vết": "Could not delete trace link",
  "Không tạo được từ mẫu": "Could not create from template",
  "Không mở được nhận xét": "Could not open comment",
  "Không mở được comment ticket": "Could not open ticket comment",
  "Không cập nhật được nhận xét": "Could not update comment",
  "Không đánh dấu được": "Could not mark comment",
  "Không gửi được nhận xét": "Could not send comment",
  "Không gửi được trả lời": "Could not send reply",
  "Không xuất được tài liệu": "Could not export document",
  "Không tải được ticket": "Could not load tickets",
  "Không tải được audit log": "Could not load audit log",
  "Ticket có thể đã bị xóa hoặc bạn không còn quyền truy cập.": "Ticket may have been deleted or you no longer have access.",
  "Tài liệu có thể đang được người khác chỉnh sửa. Vui lòng tải lại trước khi sửa tiếp.": "Document may be edited by another user. Please reload before editing.",
  "Tài liệu có thể đang được người khác chỉnh sửa.": "Document may be edited by another user.",
  "BE chưa cập nhật trạng thái work item.": "Backend failed to update work item status.",
  "BE chưa lưu được cấu hình cột.": "Backend failed to save column configuration.",
  "BE chưa trả về luồng trao đổi của ticket.": "Backend failed to load ticket comments.",
  "BE chưa lưu được trao đổi ticket.": "Backend failed to save ticket comment.",
  "Bạn chỉ có thể sửa comment do chính mình tạo.": "You can only edit comments created by yourself.",
  "Bạn chỉ có thể xóa comment do chính mình tạo.": "You can only delete comments created by yourself.",
  "Kiểm tra định dạng file hoặc quyền dự án/tài liệu.": "Check file format or project/document permissions.",
  "BE chưa lưu được thay đổi này.": "Backend failed to save this change.",
  "BE chưa tạo được bản sao ticket này.": "Backend failed to duplicate this ticket.",
  "BE chưa xóa được ticket này.": "Backend failed to delete this ticket.",
  "BE từ chối request hoặc mã dự án đã tồn tại.": "Backend rejected request or project code already exists.",
  "BE chưa lưu được thay đổi dự án.": "Backend failed to save project changes.",
  "BE chưa xóa được dự án này. Kiểm tra quyền hoặc thử lại.": "Backend failed to delete project. Check permissions or try again.",
  "Kiểm tra project đích và kết nối BE.": "Check target project and backend connection.",
  "BE chưa lưu được thay đổi tài liệu.": "Backend failed to save document changes.",
  "BE chưa lưu được trạng thái Triển khai.": "Backend failed to save Deployed status.",
  "BE chưa xóa được tài liệu này. Kiểm tra quyền hoặc thử lại.": "Backend failed to delete document. Check permissions or try again.",
  "BE chưa xóa được comment này. Vui lòng thử lại.": "Backend failed to delete comment. Please try again.",
  "BE chưa nhận được file hoặc định dạng chưa được hỗ trợ.": "Backend did not receive file or format is not supported.",
  "Vui lòng kiểm tra quyền truy cập hoặc thử lại.": "Please check access permissions or try again.",
  "Vui lòng kiểm tra quyền chỉnh sửa hoặc thử lại sau.": "Please check edit permissions or try again later.",
  "Vui lòng kiểm tra quyền chỉnh sửa tài liệu hoặc thử lại.": "Please check document edit permissions or try again.",
  "Kiểm tra quyền chỉnh sửa tài liệu rồi thử lại.": "Check document edit permissions and try again.",
  "Tag này chưa được lưu vào Neon.": "This tag has not been saved to database.",
  "Kiểm tra quyền rồi thử lại.": "Check permissions and try again.",
  "Kiểm tra quyền dự án rồi thử lại.": "Check project permissions and try again.",
  "Kiểm tra quyền tạo tài liệu trong dự án.": "Check document creation permissions in project.",
  "Nhận xét có thể đã bị xóa hoặc bạn không còn quyền truy cập.": "Comment may have been deleted or you no longer have access.",
  "Comment có thể đã bị xóa hoặc bạn không còn quyền truy cập.": "Comment may have been deleted or you no longer have access.",
  "BE chưa lưu được thay đổi nhận xét.": "Backend failed to save comment changes.",
  "BE chưa cập nhật được trạng thái comment.": "Backend failed to update comment status.",
  "Kiểm tra BE hoặc tài liệu đang chọn.": "Check backend connection or selected document.",
  "Kiểm tra BE hoặc thử lại sau.": "Check backend connection or try again later.",
  "Vui lòng kiểm tra quyền truy cập hoặc thử lại sau.": "Please check access permissions or try again later.",
  "Không thể xuất danh sách ticket lúc này.": "Cannot export ticket list at this time.",
  "Không thể xuất lịch sử hoạt động lúc này.": "Cannot export activity log at this time."
};
