import cors from "cors";
import Joi from "joi";

const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
require('dotenv').config()
const {v4 : uuidv4} =  require("uuid")
const app = express();
const { VertexAI }= require('@google-cloud/vertexai')

app.use(cors({
    origin:'*',
    methods:['GET','PUT','POST','DELETE']
}));

app.use(express.json());
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

// VERTEX AI 
const vertex_ai= new VertexAI({project:'sharp-starlight-420709',
location:'us-central1', 
// Credential: process.env.GOOGLE_CREDS,
});
const model='gemini-1.0-pro';

const generativeModel = vertex_ai.getGenerativeModel({
    model:model,
    generationConfig:{
        'maxOutputTokens':25,
        'temperature':1,
        'topP':1,
    },
    safetysettings:[
        {
            'category': 'HARM_CATEGORY_HATE_SPEECH',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            'category': 'HARM_CATEGORY_DANGEROUS_CONTENT',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            'category': 'HARM_CATEGORY_HARASSMENT',
            'threshold': 'BLOCK_MEDIUM_AND_ABOVE'
        }
    ],
});

async function generateContentRes(title: string){
    const req={
        contents:[
            {role:'user',parts:[{text:`I'm building todo application for users to manage their tasks. Your job is to generate a short and COMPLETE description in one line when I give Todo task title as an input to you.Dont include ## in the start of the response. The output should not contain anything else, just the description for the todo task title.It should be complete and not half baked.
                        my title is : ${title}`}]}
        ],
    };
    console.log({generativeModel})
    const result = await generativeModel.generateContent(req);
    const response = result.response;
    const name = undefined;
    console.log({res: response.candidates[0]?.content?.parts[0]?.text})
    console.log('Response: ', JSON.stringify(response));
    return response.candidates[0]?.content?.parts[0]?.text
}

app.post('/api/generate-content',async(req:any,res:any)=>{
    try{
        const generatedContent= await generateContentRes(req.body.title || "");
        res.status(200).json({description: generatedContent});
    }catch(error){
        console.log('Error generating content:',error);
        res.sendStatus(500).send('internal server error');
    }
});
let todos:any= [];

const { Pool }=require('pg');

const poolConfig = {
    connectionString: process.env.DB_URL,
    // host:process.env.DB_HOST,
    // password:process.env.DB_PASSWORD,
    // database:process.env.DB_NAME,
    // user:process.env.DB_USER,
    // port: process.env.DB_PORT,
}
const pool= new Pool(poolConfig)
pool.connect((err: any) => {
    if (err) {
        console.log(process.env.DB_URL)
        return console.error('Error acquiring client', err);
    }
    console.log('Connected to PostgreSQL database');
    // client.query('SELECT current_user', (err, result) => {
    //         release(); 
    //         if (err) {
    //         return console.error('Error executing query', err.stack);
    //     }
    //     console.log('Current user:', result.rows[0].current_user);
    // });
});

app.get('/', (req: any, res: any) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.get('/api/todos', async(req: any, res: any) =>{    
    try{
        const queryText = 'SELECT * FROM todos';
        const result= await pool.query(queryText);
        const todos=result.rows;
        res.status(200).json(todos);
    }catch(error){
        console.log({error})
        return res.status(500).send('Internal Server Error')
    }
});

app.get('/api/todos/:id', (req: any, res: any) => {
    const todo = todos.find((c: any) => c.id === (req.params.id));
    if (!todo) {
        res.status(404).send('The todo with the given ID was not found');
    }
    res.send(todo);
});

//POST
app.post('/api/todos', async (req: any, res: any) => {
    const { title= "", description= "", status = ""}= req?.body
    const taskId = uuidv4()
    const { error } = validateTodo(req.body);
    if (error) {
        return res.status(400).send(error.details[0].message);
    }
    // todos.push(todo);
    const queryText ='INSERT INTO todos (id, title, description, status, createdAt, updatedAt) VALUES ($1,$2,$3,$4, now(), now())';
    const queryValues=[taskId,title,description,status];
    
    try{    
        const result= await pool.query(queryText,queryValues);
        console.log('Task inserted into database');
        const insertedTask = {
            id: taskId,
            title,
            description,
            status,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        io.emit('newTask',insertedTask);
        //   io.on('disconnect', () => {
        //     console.log('Client disconnected');
        //   });
       return res.status(201).json(insertedTask)
    }catch(error){
        console.log({error})
        return res.status(500).send('Internal Server Error')
    }
});

app.get('/api/posts/:year/:month', (req: any, res: any) =>{
    res.send(req.query);
});

//PUT
app.put('/api/todos/:id',async (req: any, res: any) =>{
    //Look up the todo, else return 404
    //Validate, if not return 400- bad req
    //update todo and return updated todo
    console.log({req: req.params})
    const todo = todos.find((c: any) => c.id === (req.params.id));
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
    const { title, description, status}= req.body;
    const taskId=req.params.id;

    const updateQuery= 'UPDATE todos SET title = $1, description= $2,status =$3, "updatedat"=now() WHERE id= $4';   
    const updateValues=[title,description,status,taskId]
    try{
        await pool.query(updateQuery,updateValues);
        console.log('Task updated in database');
        const updatedTaskQuery = 'SELECT * FROM todos WHERE id = $1';
        const updatedTaskResult = await pool.query(updatedTaskQuery, [taskId]);
        const updatedTask = updatedTaskResult.rows[0];

        io.emit('taskUpdated',updatedTask);

        // res.send(updatedTodo)
        return res.json(updatedTask)

    }catch(error){
        console.error('Error updating task:', error);
        return res.status(500).send('Internal Server Error');
    }
});

//DELETE
app.delete('/api/todos/:id', async(req: any,res: any) => {
    const todoId = req.params.id;        
    const queryText = 'DELETE FROM todos WHERE id = $1';
    const queryValues = [todoId];
    console.log(todoId)
    try {
        await pool.query(queryText, queryValues);
        console.log('Task deleted successfully');
        io.emit('taskDeleted', todoId);
        todos = todos.filter((todo : any)=> todo.id !== todoId);
        // res.send(todos)
        return  res.status(200).send({"status": "success"});
    } catch (error) {
        console.error('Error deleting task:', error);
        return res.status(500).send('Internal Server Error');
    }
});

app.delete('/api/todos', async(req: any,res: any) => {
    const queryText = 'DELETE FROM todos WHERE status = $1';
    const queryValues = ['completed'];
    try {
        await pool.query(queryText, queryValues);
        // console.log('Completed tasks deleted successfully');
        console.log("12345678")
        io.emit('tasksDeleted');
        const updatedTasksResult = await pool.query('SELECT * FROM todos');
        const updatedTasks = updatedTasksResult.rows;
        return res.status(200).json(updatedTasks);
    } catch (error) {
        console.error('Error deleting completed tasks:', error);
        return res.status(500).send('Internal Server Error');
    }
});

io.on('connection', (socket: any) => {
//   console.log('a user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected');
});
});

server.listen(3001, () => {
    console.log('server running at http://localhost:3001');
  });

  function validateTodo(todo: any){
    const schema = Joi.object({
        title: Joi.string().min(2).required(),
        description: Joi.string().min(2).required(),
        status: Joi.string().required()
    });
    return schema.validate(todo);    
}

