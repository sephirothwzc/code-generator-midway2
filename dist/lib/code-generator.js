"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const lodash_1 = require("lodash");
const shelljs_1 = __importDefault(require("shelljs"));
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelize_1 = require("sequelize");
const code_entity_1 = require("./code-template/code-entity");
const code_type_graphql_1 = require("./code-template/code-type-graphql");
const code_service_1 = require("./code-template/code-service");
const code_operation_1 = require("./code-template/code-operation");
const code_resolver_1 = require("./code-template/code-resolver");
const code_react_gql_1 = require("./code-template/code-react-gql");
const code_react_antd_list_1 = require("./code-template/code-react-antd-list");
const code_react_antd_item_1 = require("./code-template/code-react-antd-item");
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const bluebird_1 = __importDefault(require("bluebird"));
let sequelize;
const getConn = (config) => {
    !sequelize && (sequelize = new sequelize_typescript_1.Sequelize(config));
    return sequelize;
};
const codeTypeArray = [
    'entity',
    'typeGraphql',
    'operation',
    'resolver',
    'service',
    'gql-react',
    'react-antd-list',
    'react-antd-item',
];
const allFun = {
    entity: {
        fun: code_entity_1.send,
        path: `./src/lib/model`,
        suffix: `entity`,
        extension: 'ts',
    },
    typeGraphql: {
        fun: code_type_graphql_1.send,
        path: (tableName) => {
            const fileName = tableName.replace(/_/g, '-');
            return `./src/graphql/${fileName}`;
        },
        suffix: 'gql',
    },
    service: {
        fun: code_service_1.send,
        path: `./src/service`,
        suffix: 'service',
    },
    operation: {
        fun: code_operation_1.send,
        path: (tableName) => {
            const fileName = tableName.replace(/_/g, '-');
            return `./src/graphql/${fileName}`;
        },
        extension: 'gql',
        fileName: 'operation',
    },
    resolver: {
        fun: code_resolver_1.send,
        path: `./src/resolver`,
        suffix: 'resolver',
    },
    'gql-react': {
        fun: code_react_gql_1.send,
        path: (tableName) => {
            const fileName = tableName.replace(/_/g, '-');
            return `./src/graphql/${fileName}`;
        },
        extension: 'gql',
        fileName: 'operation',
    },
    'react-antd-list': {
        fun: code_react_antd_list_1.send,
        path: (tableName) => {
            const fileName = tableName.replace(/_/g, '-');
            return `./src/views/${fileName}`;
        },
        extension: 'tsx',
        fileName: 'list',
    },
    'react-antd-item': {
        fun: code_react_antd_item_1.send,
        path: (tableName) => {
            const fileName = tableName.replace(/_/g, '-');
            return `./src/views/${fileName}`;
        },
        extension: 'tsx',
        fileName: 'item',
    },
};
const envConfig = (env) => {
    const configPath = './database/config.json';
    try {
        const dbConfig = shelljs_1.default.cat(configPath);
        const result = JSON.parse(dbConfig);
        return (0, lodash_1.get)(result, env);
    }
    catch (error) {
        console.error(chalk_1.default.white.bgRed.bold(`Error: `) + `\t [${configPath}] not find,must have local umzug!`);
        process.exit(1);
    }
};
const confirmDBConfig = async (database) => {
    const questions = [
        {
            name: 'dbRest',
            type: 'confirm',
            message: `????????????[${database}]??????`,
            default: 'Y',
        },
    ];
    const value = await inquirer_1.default.prompt(questions);
    !value.dbRest && process.exit(1);
};
const queryTable = async (config) => {
    const sequelize = getConn(config);
    const result = await sequelize.query(`select table_name AS tableName,table_comment AS tableComment,table_type AS tableType
     from information_schema.tables where table_name <> 'sequelizemeta' 
     and table_schema=:database order by table_name`, {
        replacements: {
            database: config.database,
        },
        type: sequelize_1.QueryTypes.SELECT,
    });
    const tableList = result.map((p) => ({
        name: `${p.tableName}--${p.tableComment}`,
        value: p,
    }));
    return tableList;
};
const fileSend = async (tables, types, config) => {
    tables &&
        types &&
        (await bluebird_1.default.each(tables, async (p) => {
            const columnList = await queryColumn(config, p.tableName);
            const keyColumnList = await queryKeyColumn(config, p.tableName);
            await bluebird_1.default.each(types, async (x) => {
                const fileObj = await (0, lodash_1.get)(allFun, x);
                const codeStr = await fileObj.fun({ columnList, tableItem: p, keyColumnList });
                codeStr && (await createFile(fileObj, p.tableName, codeStr, x));
            });
        }));
};
const createFile = async (fileObj, tableName, txt, type) => {
    var _a;
    if (!txt) {
        return;
    }
    const fileName = tableName.replace(/_/g, '-');
    const objath = (0, lodash_1.get)(fileObj, 'path', `./out/${type}`);
    const filePath = (0, lodash_1.isString)(objath) ? objath : objath(tableName);
    console.log(filePath);
    shelljs_1.default.mkdir('-p', filePath);
    const lastFileName = (0, lodash_1.get)(fileObj, 'fileName', fileName);
    const overFileName = (0, lodash_1.isString)(lastFileName) ? lastFileName : lastFileName(tableName);
    const overSuffix = (fileObj === null || fileObj === void 0 ? void 0 : fileObj.suffix) || '';
    const overExtension = fileObj.extension || 'ts';
    const fullPath = `${filePath}/${overFileName}.${overSuffix}.${overExtension}`.replace(/\.\./g, '.');
    await ((_a = fileWritePromise(fullPath, txt)) === null || _a === void 0 ? void 0 : _a.then(() => {
        success(fullPath);
    }).catch((error) => {
        console.error(chalk_1.default.white.bgRed.bold(`Error: `) + `\t [${overFileName}]${error}!`);
    }));
};
const success = (fullPath) => {
    console.log(chalk_1.default.white.bgGreen.bold(`Done! File FullPath`) + `\t [${fullPath}]`);
    shelljs_1.default.exec(`npx prettier --write ${fullPath}`);
};
const fileWritePromise = (fullPath, txt) => {
    if (!txt) {
        return;
    }
    const fsWriteFile = (0, util_1.promisify)(fs_1.default.writeFile);
    return fsWriteFile(fullPath, txt);
};
const init = async (config) => {
    const db = envConfig(config.configNodeEnv);
    await confirmDBConfig(db.database);
    const tableList = await queryTable(db);
    const tables = await askListQuestions(tableList, 'tableName', 'checkbox');
    const types = await askListQuestions(codeTypeArray, 'fileType', 'checkbox');
    await fileSend(tables.tableName, types.fileType, db);
    console.log(chalk_1.default.white.bgGreen.bold(`success!`));
    process.exit();
};
exports.init = init;
const askListQuestions = (list, key, type = 'list', message = key) => {
    const questions = [
        {
            name: key,
            type,
            message: message,
            choices: list,
        },
    ];
    return inquirer_1.default.prompt(questions);
};
const queryColumn = async (config, name) => {
    const sql = `SELECT table_name as tableName,column_name as columnName,
COLUMN_COMMENT as columnComment,column_type as columnType,
DATA_TYPE as dataType, CHARACTER_MAXIMUM_LENGTH as characterMaximumLength,
is_Nullable as isNullable
 FROM information_schema.columns 
  WHERE table_schema=:database AND table_name=:name 
  order by COLUMN_NAME`;
    const sequelize = getConn(config);
    const result = await sequelize.query(sql, {
        replacements: {
            database: config.database,
            name,
        },
        type: sequelize_1.QueryTypes.SELECT,
    });
    return result || [];
};
const queryKeyColumn = async (config, name) => {
    const sql = `SELECT C.TABLE_SCHEMA as tableSchema,
           C.REFERENCED_TABLE_NAME as referencedTableName,
           C.REFERENCED_COLUMN_NAME as referencedColumnName,
           C.TABLE_NAME as tableName,
           C.COLUMN_NAME as columnName,
           C.CONSTRAINT_NAME as constraintName,
           T.TABLE_COMMENT as tableComment,
           R.UPDATE_RULE as updateRule,
           R.DELETE_RULE as deleteRule
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE C
      JOIN INFORMATION_SCHEMA. TABLES T
        ON T.TABLE_NAME = C.TABLE_NAME
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS R
        ON R.TABLE_NAME = C.TABLE_NAME
       AND R.CONSTRAINT_NAME = C.CONSTRAINT_NAME
       AND R.REFERENCED_TABLE_NAME = C.REFERENCED_TABLE_NAME
      WHERE C.REFERENCED_TABLE_NAME IS NOT NULL 
				AND (C.REFERENCED_TABLE_NAME = :tableName or C.TABLE_NAME = :tableName)
        AND C.TABLE_SCHEMA = :database
        group by C.CONSTRAINT_NAME order by C.CONSTRAINT_NAME`;
    const sequelize = getConn(config);
    const result = await sequelize.query(sql, {
        replacements: {
            database: config.database,
            tableName: name,
        },
        type: sequelize_1.QueryTypes.SELECT,
    });
    return result || [];
};
//# sourceMappingURL=code-generator.js.map