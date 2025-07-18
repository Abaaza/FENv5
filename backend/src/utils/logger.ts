import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_DIR || (process.env.AWS_LAMBDA_FUNCTION_NAME ? '/tmp/logs' : 'logs');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about the colors
winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format,
  }),
  // Error log file
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json()
    ),
  }),
  // Combined log file
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json()
    ),
  }),
];

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
});

// Create specialized loggers
export const projectLogger = logger.child({ service: 'projects' });
export const excelLogger = logger.child({ service: 'excel' });
export const matchingLogger = logger.child({ service: 'matching' });

export default logger;
