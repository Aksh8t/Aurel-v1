class APIError(Exception):
    def __init__(self, status_code: int, error: str, detail: str, code: str) -> None:
        self.status_code = status_code
        self.error = error
        self.detail = detail
        self.code = code
        super().__init__(detail)


def not_found(detail: str) -> APIError:
    return APIError(404, "Resource not found", detail, "not_found")


def bad_request(detail: str) -> APIError:
    return APIError(400, "Validation error", detail, "bad_request")


def processing_error(detail: str) -> APIError:
    return APIError(422, "Processing error", detail, "processing_error")
