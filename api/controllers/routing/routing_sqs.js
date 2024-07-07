'use strict';

const THIS_BASE_PATH = process.env.THIS_BASE_PATH;
const CONTROLLERS_BASE = THIS_BASE_PATH + '/api/controllers/';

//const SQS_REGION = "ap-northeast-1";
const SQS_REGION = "elasticmq";
const SQS_ENDPOINT = process.env.ROUTING_SQS_ENDPOINT;

const SQS_TARGET_FNAME = "sqs.json";
const DEFAULT_HANDLER = "handler";

const AWS = require('aws-sdk');
AWS.config.update({
    region: SQS_REGION
});
const sqs = new AWS.SQS({
    apiVersion: '2012-11-05',
    endpoint: SQS_ENDPOINT
});

const fs = require('fs');

function parse_sqs() {
    // sqs.jsonの検索
    const folders = fs.readdirSync(CONTROLLERS_BASE);
    folders.forEach(folder => {
        try {
            const stats_dir = fs.statSync(CONTROLLERS_BASE + folder);
            if (!stats_dir.isDirectory())
                return;

            const fname = CONTROLLERS_BASE + folder + "/" + SQS_TARGET_FNAME;
            if (!fs.existsSync(fname))
                return;
            const stats_file = fs.statSync(fname);
            if (!stats_file.isFile())
                return;

            // pollerの登録
            const defs = JSON.parse(fs.readFileSync(fname).toString());
            parse_sqs_json(defs, CONTROLLERS_BASE + folder, folder);
        } catch (error) {
            console.log(error);
        }
    });
}

function parse_sqs_json(defs, folder, folder_name) {
    defs.forEach(item => {
        if (!item.enable)
            return;

        const handler = item.handler || DEFAULT_HANDLER;
        const proc = require(folder)[handler];
        const params = {
            QueueUrl: item.QueueUrl,
            AttributeNames: item.AttributeNames,
            MaxNumberOfMessages: (item.MaxNumberOfMessages === undefined) ? 1 : item.MaxNumberOfMessages,
            MessageAttributeNames: item.MessageAttributeNames,
            VisibilityTimeout: (item.VisibilityTimeout === undefined) ? 30 : item.VisibilityTimeout,
            WaitTimeSeconds: (item.WaitTimeSeconds === undefined) ? 20 : item.WaitTimeSeconds
        };

        continuousReceive(params, proc);

        console.log("sqs(" + item.QueueUrl + ") " + handler + ' ' + folder_name);
    });
}

async function continuousReceive(params, func) {
    while (true) {
        try {
            await new Promise((resolve, reject) => {
                sqs.receiveMessage(params, async (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    if (!data.Messages) {
                        return resolve('message empty');
                    }

                    try {
                        const event = {
                            Records: data.Messages.map(item => {
                                return {
                                    messageId: item.MessageId,
                                    receiptHandle: item.ReceiptHandle,
                                    body: item.Body,
                                    attributes: item.Attributes,
                                    messageAttributes: item.MessageAttributes,
                                    md5OfBody: item.MD5OfBody,
                                    md5OfMessageAttributes: item.MD5OfMessageAttributes,
                                    awsRegion: SQS_REGION
                                }
                            })
                        };

                        const success_return = (msg) => {
                            if (data.Messages) {
                                const deleteParams = {
                                    QueueUrl: params.QueueUrl,
                                    Entries: data.Messages.map(item => {
                                        return {
                                            Id: item.MessageId,
                                            ReceiptHandle: item.ReceiptHandle
                                        }
                                    })
                                };
                                sqs.deleteMessageBatch(deleteParams, (err, data) => {
                                    if (err) {
                                        return reject(err);
                                    } else {
                                        return resolve();
                                    }
                                });
                            }
                        };
                        const context = {
                            succeed: success_return,
                            fail: (error) => resolve(error)
                        };
                        const task = func(event, context, (error, response) => {
                            if (error) return resolve(error);
                            return success_return(response);
                        });
                        if (task instanceof Promise || (task && typeof task.then === 'function')) {
                            return task.then(ret => {
                                    if (ret)
                                        return success_return(ret);
                                })
                                .catch(err => resolve(err));
                        } else {
                            if (task !== undefined)
                                success_return(task);
                        }
                    } catch (error) {
                        console.log(error);
                        return reject(err);
                    }
                });
            });
        } catch (error) {
            console.log(error);
            return;
        }
    }
}

module.exports = parse_sqs();
