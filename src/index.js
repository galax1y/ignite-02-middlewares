const express = require('express');
const cors = require('cors');

const { v4: uuidv4, validate } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors());

const users = [];

function checksExistsUserAccount(request, response, next) {
  const { username } = request.headers

  // Try to find the account based on the username provided in the request
  const user = users.find(user => user.username === username)

  // Should return status code 404 if user does not exist
  if (!user) {
    return response.status(404).json({message: 'User not found'}) 
  }

  // Send it to the next step, append user to the request
  request.user = user
  next()
}

function checksCreateTodosUserAvailability(request, response, next) {
  const { user } = request

  // Should be able to create unlimited todos if it's a premium account user.
  if (user.pro) {
    next()
  }

  // Should be able to create up to 10 todos if it's a free account user.
  if (!user.pro && user.todos.length >= 10) {
    return response.status(403)
    .json({message: 'You have reached the limit of free todos, sign Premium for more.'}) 
  }

  next()
}

function checksTodoExists(request, response, next) {
  const { username } = request.headers
  const { id } = request.params

  // ID in request parameters should be a valid UUID
  if (!validate(id)) {
    return response.status(400)
    .json({error: 'Id in request parameters is not a valid UUID'})
  }
  
  // Should be able to find the user through the username
  const user = users.find(user => username === user.username)
  if (!user) {
    return response.status(404)
    .json({error: 'User not found'})
  }

  // Should be able to find the todo by the id
  const todo = user.todos.find(todo => id === todo.id)
  if (!todo) {
    return response.status(404)
    .json({error: 'Todo not found'})
  }

  // If everything is valid, append data to the request and send it to the next step
  request.todo = todo
  request.user = user
  next()
}

function findUserById(request, response, next) {
  const { id } = request.params

  const user = users.find(user => user.id === id)

  if (!user) {
    return response.status(404)
    .json({message: 'Id does not belong to any user'})
  }

  request.user = user
  next()  
}

app.post('/users', (request, response) => {
  const { name, username } = request.body;

  const usernameAlreadyExists = users.some((user) => user.username === username);

  if (usernameAlreadyExists) {
    return response.status(400).json({ error: 'Username already exists' });
  }

  const user = {
    id: uuidv4(),
    name,
    username,
    pro: false,
    todos: []
  };

  users.push(user);

  return response.status(201).json(user);
});

app.get('/users/:id', findUserById, (request, response) => {
  const { user } = request;

  return response.json(user);
});

app.patch('/users/:id/pro', findUserById, (request, response) => {
  const { user } = request;

  if (user.pro) {
    return response.status(400).json({ error: 'Pro plan is already activated.' });
  }

  user.pro = true;

  return response.json(user);
});

app.get('/todos', checksExistsUserAccount, (request, response) => {
  const { user } = request;

  return response.json(user.todos);
});

app.post('/todos', checksExistsUserAccount, checksCreateTodosUserAvailability, (request, response) => {
  const { title, deadline } = request.body;
  const { user } = request;

  const newTodo = {
    id: uuidv4(),
    title,
    deadline: new Date(deadline),
    done: false,
    created_at: new Date()
  };

  user.todos.push(newTodo);

  return response.status(201).json(newTodo);
});

app.put('/todos/:id', checksTodoExists, (request, response) => {
  const { title, deadline } = request.body;
  const { todo } = request;

  todo.title = title;
  todo.deadline = new Date(deadline);

  return response.json(todo);
});

app.patch('/todos/:id/done', checksTodoExists, (request, response) => {
  const { todo } = request;

  todo.done = true;

  return response.json(todo);
});

app.delete('/todos/:id', checksExistsUserAccount, checksTodoExists, (request, response) => {
  const { user, todo } = request;

  const todoIndex = user.todos.indexOf(todo);

  if (todoIndex === -1) {
    return response.status(404).json({ error: 'Todo not found' });
  }

  user.todos.splice(todoIndex, 1);

  return response.status(204).send();
});

module.exports = {
  app,
  users,
  checksExistsUserAccount,
  checksCreateTodosUserAvailability,
  checksTodoExists,
  findUserById
};