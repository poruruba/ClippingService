class AlexaSmartHomeUtils{
    constructor(){
        this.intentHandles = new Map();
    }

    intent( matcher, handle ){
        this.intentHandles.set(matcher, handle);
    }

    defaultIntent( handle ){
        this.defaultHandle = handle;
    }

    handle(){
        return async (handlerInput, context) => {
            var intent = handlerInput.directive.header.namespace + '.' + handlerInput.directive.header.name;
//            console.log('intent: ' + intent);
            var handler = this.intentHandles.get(intent);
            if( handler ){
                return handler(handlerInput, context);
            }else{
                if( this.defaultHandle )
                    return this.defaultHandle(intent, handlerInput, context);
                else
                    console.log('not found intent: ' + intent);
            }
        }
    }
}

module.exports = AlexaSmartHomeUtils;
