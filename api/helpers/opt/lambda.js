'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';

function lambdaInvoke(params, callback) {
  var folder = CONTROLLERS_BASE + params.FunctionName;
  var func = require(folder).handler;
  if( !func ){
    if( callback )
      callback("lambdaInvoke not found");
    else
      throw "lambdaInvoke not found";
  }

  if (params.InvocationType == 'RequestResponse') {
    var t = new Promise((resolve, reject) =>{
      const context = {
        succeed: (msg) => resolve(msg),
        fail: (error) => reject(error)
      };

      const task = func(JSON.parse(params.Payload), context, (error, response) => {
        console.log('callback called');
        if (error) return reject(error);
        return resolve(response);
      });
      if (task instanceof Promise || (task && typeof task.then === 'function')) {
        return task.then(ret => {
          if (ret)
            return resolve(ret);
          console.log('promise return undefined');
        })
        .catch(err => reject(err));
      }
    });

    return t.then(ret =>{
      if( callback )
        callback(null, {
          StatusCode: 200,
          payload: JSON.stringify(ret)
        });
      return {
        promise: async () =>{
          return {
            StatusCode: 200,
            payload: JSON.stringify(ret)
          }
        }
      }
    })
    .catch(err =>{
      if( callback )
        callback({
          StatusCode: 200,
          FunctionError: "Unhandled",
          payload: JSON.stringify(err)
      });
      return {
        promise: async () =>{
          return {
            StatusCode: 200,
            FunctionError: "Unhandled",
            payload: JSON.stringify(err)
          };
        }
      };
    });
  } else
    if (params.InvocationType == 'Event') {
      var t = new Promise((resolve, reject) =>{
        const context = {
          succeed: (msg) => resolve(msg),
          fail: (error) => reject(error),
        };

        const task = func(JSON.parse(params.Payload), context, (error, response) => {
          console.log('callback called');
          if (error) return reject(error);
          resolve(response);
        });
        if (task instanceof Promise || (task && typeof task.then === 'function')) {
          task.then(ret => {
            if (ret) return resolve(ret);
            console.log('promise return undefined');
          })
          .catch(err => reject(err) );
        }
      });

      t.then(ret =>{
        console.log("LambdaProxy OK:", ret);
      })
      .catch(err =>{
        console.log("LambdaProxy Error:", err);
      });

      if (callback) {
        callback(null, {
          StatusCode: 202,
          Payload: ""
        });
      }
      return {
        promise: async () => {
          return {
            StatusCode: 202,
            Payload: ""
          }
        }
      };
    } else
      if (params.InvocationType == "DryRun") {
        callback(null, {
          StatusCode: 200,
          Payload: ""
        });
      }
}

module.exports = {
  invoke: lambdaInvoke
};
