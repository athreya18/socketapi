"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const joi_1 = __importDefault(require("joi"));
const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
require('dotenv').config();
const { v4: uuidv4 } = require("uuid");
const app = express();
app.use((0, cors_1.default)());
app.use(express.json());
const server = createServer(app);
const io = new Server(server);
let todos = [];
const { Pool } = require('pg');
const poolConfig = {
    connectionString: process.env.DB_URL,
    // user:process.env.DB_USER,
    // password:process.env.DB_PASSWORD,
    // host:process.env.DB_HOST,
    // database:process.env.DB_NAME,
    // port: process.env.DB_PORT,
};
const pool = new Pool(poolConfig);
pool.connect((err) => {
    if (err) {
        return console.error('Error acquiring client', err);
    }
    console.log('Connected to PostgreSQL database');
    // client.query('SELECT current_user', (err, result) => {
    //     release();
    //     if (err) {
    //         return console.error('Error executing query', err.stack);
    //     }
    //     console.log('Current user:', result.rows[0].current_user);
    // });
});
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});
app.get('/api/todos', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const queryText = 'SELECT * FROM todos';
        const result = yield pool.query(queryText);
        const todos = result.rows;
        res.status(200).json(todos);
    }
    catch (error) {
        console.log({ error });
        return res.status(500).send('Internal Server Error');
    }
}));
app.get('/api/todos/:id', (req, res) => {
    const todo = todos.find((c) => c.id === (req.params.id));
    if (!todo) {
        res.status(404).send('The todo with the given ID was not found');
    }
    res.send(todo);
});
//POST
app.post('/api/todos', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title = "", description = "", status = "" } = req === null || req === void 0 ? void 0 : req.body;
    const taskId = uuidv4();
    const { error } = validateTodo(req.body);
    if (error) {
        // 400 Bad Request
        return res.status(400).send(error.details[0].message);
    }
    // todos.push(todo);
    const queryText = 'INSERT INTO todos (id, title, description, status, createdAt, updatedAt) VALUES ($1,$2,$3,$4, now(), now())';
    const queryValues = [taskId, title, description, status];
    try {
        const result = yield pool.query(queryText, queryValues);
        console.log('Task inserted into database');
        const insertedTask = {
            id: taskId,
            title,
            description,
            status,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Broadcast the received message to all connected clients
        io.emit('message', insertedTask);
        //   io.on('disconnect', () => {
        //     console.log('Client disconnected');
        //   });
        return res.status(201).json(insertedTask);
    }
    catch (error) {
        console.log({ error });
        return res.status(500).send('Internal Server Error');
    }
}));
app.get('/api/posts/:year/:month', (req, res) => {
    res.send(req.query);
});
//PUT
app.put('/api/todos/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //Look up the todo, else return 404
    //Validate, if not return 400- bad req
    //update todo and return updated todo
    console.log({ req: req.params });
    const todo = todos.find((c) => c.id === (req.params.id));
    // console.log(req.params.id)
    // if (!todo) // 404
    //     return res.status(404).send('The Todo with the given ID was not found');
    // const { error } =validateTodo(req.body);
    // if (error)
    //     return res.status(400).send(error.details[0].message);
    // const finalres = todos.map((res) => {
    //     if(res.id === (req.params.id)){
    //         return {
    //             ...res,
    //             title: req.body.title,
    //             description: req.body.description,
    //             status: req.body.status
    //         }
    //     }else{
    //         return res
    //     }
    // })
    // todos = finalres
    // console.log({finalres})
    // if (error) {
    //     // 400 Bad Request
    //     return res.status(400).send(error.details[0].message);
    // }
    // res.send(todos.find(c => c.id === (req.params.id)));
    const { title, description, status } = req.body;
    const taskId = req.params.id;
    const updateQuery = 'UPDATE todos SET title = $1, description= $2,status =$3, "updatedat"=now() WHERE id= $4';
    const updateValues = [title, description, status, taskId];
    try {
        yield pool.query(updateQuery, updateValues);
        console.log('Task updated in database');
        const updatedTaskQuery = 'SELECT * FROM todos WHERE id = $1';
        const updatedTaskResult = yield pool.query(updatedTaskQuery, [taskId]);
        const updatedTask = updatedTaskResult.rows[0];
        io.emit('taskUpdated', updatedTask);
        // res.send(updatedTodo)
        return res.json(updatedTask);
    }
    catch (error) {
        console.error('Error updating task:', error);
        return res.status(500).send('Internal Server Error');
    }
}));
//DELETE
app.delete('/api/todos/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const todoId = req.params.id;
    const queryText = 'DELETE FROM todos WHERE id = $1';
    const queryValues = [todoId];
    console.log(todoId);
    try {
        yield pool.query(queryText, queryValues);
        console.log('Task deleted successfully');
        io.emit('taskDeleted', todoId);
        todos = todos.filter((todo) => todo.id !== todoId);
        // res.send(todos)
        return res.status(200).send({ "status": "success" });
    }
    catch (error) {
        console.error('Error deleting task:', error);
        return res.status(500).send('Internal Server Error');
    }
}));
app.delete('/api/todos', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const queryText = 'DELETE FROM todos WHERE status = $1';
    const queryValues = ['completed'];
    try {
        yield pool.query(queryText, queryValues);
        console.log('Completed tasks deleted successfully');
        io.emit('tasksDeleted');
        const updatedTasksResult = yield pool.query('SELECT * FROM todos');
        const updatedTasks = updatedTasksResult.rows;
        return res.status(200).json(updatedTasks);
    }
    catch (error) {
        console.error('Error deleting completed tasks:', error);
        return res.status(500).send('Internal Server Error');
    }
}));
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});
server.listen(3001, () => {
    console.log('server running at http://localhost:3001');
});
function validateTodo(todo) {
    const schema = joi_1.default.object({
        title: joi_1.default.string().min(2).required(),
        description: joi_1.default.string().min(2).required(),
        status: joi_1.default.string().required()
    });
    return schema.validate(todo);
}
