class RemoteConsole{
    constructor(base_url, stream, force = true){
        this.debuglog_base_url = base_url;
        this.debuglog_stream = stream;

        if( !window ){
            console.log('window not found');
            return;
        }

        window.console_rm = {
            log: async (...messages) => {
                if( this.oldLog )
                    this.oldLog(...messages);
                for (const message of messages)
                    await this.debuglog_logToServer(message, "log");
            },
            error: async (...messages) => {
                if( this.oldError )
                    this.oldError(...messages);
                for (const message of messages)
                    await this.debuglog_logToServer(message, "error");
            }
        };
        if( force ){
            this.oldLog = window.console.log;
            window.console.log = window.console_rm.log;
            this.oldError = window.console.error;
            window.console.error = window.console_rm.error;
        }

        // intecept errors
        if (!window.onerror) {
            window.onerror = async (errorMsg, url, lineNumber, column, errorObj) => {
                await this.debuglog_logToServer(errorMsg, "error");
                await this.debuglog_logToServer(errorObj, "error");
                return false;
            }
        }
    }
    
    // this is optional, but it avoids 'converting circular structure' errors
    debuglog_customStringify(inp) {
        let cache = [];
        return JSON.stringify(inp, function (key, value) {
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    // Circular reference found, discard key
                    return;
                }
                // Store value in our collection
                cache.push(value);
            }
            return value;
        });
    }

    async debuglog_logToServer(consoleMsg, source) {
        const jsonTxt = this.debuglog_customStringify(consoleMsg);
        return this.do_post(this.debuglog_base_url, {
            source: source,
            stream: this.debuglog_stream,
            message: jsonTxt
        });
    };

    async do_post(url, body) {
        const headers = new Headers({ "Content-Type": "application/json" });
      
        return fetch(url, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: headers
        })
        .then((response) => {
          if (!response.ok)
            throw new Error('status is not 200');
          return response.json();
        });
      }
}

