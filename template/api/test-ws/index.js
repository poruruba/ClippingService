'use strict';

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";

exports.handler = async (event, context) => {
  console.log(event);
  console.log(context);

  return { statusCode: 200 };
};

exports.connect_handler = async (event, context) => {
  console.log(event);
  console.log(context);

  return { statusCode: 200 };
};

exports.disconnect_handler = async (event, context) => {
  console.log(event);
  console.log(context);

  return { statusCode: 200 };
};

exports.testRoute_handler = async (event, context) => {
  console.log(event);
  console.log(context);

  return { statusCode: 200 };
};

