class ApiError extends Error {
    constructor(
        statusCode,
        message="somthing want wrong",
        errors=[],
        sttck=""
    ){
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.message = message;
        this.success = false;   
        this.errors = errors;

        if (sttck){
            this.sttck = sttck;
        }else{
            Error.captureStackTrace(this, this.constructor);
        }
    }
}


export {ApiError};