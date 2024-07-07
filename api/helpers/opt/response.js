class Response{
    constructor(context, statusCode = 200){
        this.statusCode = statusCode;
        this.headers = {'Access-Control-Allow-Origin' : '*'};
        if( context )
            this.set_body(context);
        else
            this.body = "{}";
    }

    set_error(error){
        this.body = JSON.stringify({"err": error});
        return this;
    }

    set_body(content){
        this.body = JSON.stringify(content);        
        return this;
    }
    
    get_body(){
        return JSON.parse(this.body);
    }
}

module.exports = Response;
