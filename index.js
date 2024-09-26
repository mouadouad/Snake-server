const express = require('express');
const app = express();
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter'); 
const pubClient = new Redis("redis://localhost:6379");
const subClient = pubClient.duplicate();
const server = require('http').createServer(app);
const port = process.env.PORT || 3000;
const io = require('socket.io')(server, {
  cors: {
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization"],
    credentials: true 
  }

});
const validTokens = new Set([
  "f47ac10b-58cc-4372-a567-0e02b2c3d479"
]);

function isValidToken(token) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return validTokens.has(token) || uuidRegex.test(token);
}

io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (token) {
    if (isValidToken(token)) {
      next();
    } else {
      console.log('Invalid token');
    }
  } else {
    console.log('No token provided');
  }
});

pubClient.on('error', (err) => {
  console.error('Redis pubClient error:', err);
});

subClient.on('error', (err) => {
  console.error('Redis subClient error:', err);
});
io.adapter(createAdapter(pubClient, subClient));

let lobbies = {};
let randoms = [];
const width = 1080;
const height = 1600;
const snakeWidth = 30;
const barWidth = 20;
const MAX_TIME_START_GAME = 10000;
const MAX_TIME_START_ROUND = 5000;
const leftEdge = [0, 0, barWidth, height];
const rigthEdge = [width - barWidth, 0, width, height];
const topEdge = [0, 0, width, barWidth];
const botEdge = [0, height - barWidth, width, height];
const defaultStartingX = width / 2 - snakeWidth / 2;
let timeout;

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

io.on('connection', (socket) => {
  console.log('user connected');

  socket.on('ping', function () {
    io.to(socket.id).emit('pong');
  });

  socket.on('quitWaiting', function () {
    quitWaiting(socket);
  });

  socket.on('quitGame', function () {
    quitWaiting(socket);
    quitGame(socket.room);
  });

  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.id} disconnected because ${reason}`);
    if (lobbies[socket.room]) {
      if (isPlayer('player1', socket)) {
        if (lobbies[socket.room].player1.enteredGame) {
          quitGame(socket.room);
        } else {
          quitWaiting(socket);
        }
      } else if (isPlayer('player2', socket)) {
        if (lobbies[socket.room].player2.enteredGame) {
          quitGame(socket.room);
        } else {
          quitWaiting(socket);
        }
      }
    }
  });

  socket.on('create', function (nameOfRoom) {

    //   lobbies[nameOfRoom].player1 = { "ready": false, "Rwon": 0 };
    //   lobbies[nameOfRoom].player2 = { "ready": false, "Rwon": 0 };
    //   lobbies[nameOfRoom].round = 1;

    pubClient.hget(nameOfRoom, "numbOfPlayers").then(value => {
      if(value==null){
        let side = Math.floor(Math.random() * 2);
        lobbies[nameOfRoom].player1.side = side;
        lobbies[nameOfRoom].player2.side = 1 - side;

        pubClient.hset(nameOfRoom, "numbOfPlayers", 0, "player1Side", side, "player2Side", 1 - side);
        socket.room = nameOfRoom;
        io.to(socket.id).emit('created');
        console.log(nameOfRoom + " : is created ");
      }else{
        io.to(socket.id).emit('errorCreating');
      }
    }).catch(err => {
      console.log('Error:', err);
    });
  });

  socket.on('generate', function () {
    let nameOfRoom = makeid(6);
    console.log(nameOfRoom + " : is created ");
    // lobbies[nameOfRoom].player1 = { "ready": false, "Rwon": 0 };
    // lobbies[nameOfRoom].player2 = { "ready": false, "Rwon": 0 };
    // lobbies[nameOfRoom].round = 1;

    let side = Math.floor(Math.random() * 2);
    lobbies[nameOfRoom].player1.side = side;
    lobbies[nameOfRoom].player2.side = 1 - side;

    pubClient.hset(nameOfRoom, "numbOfPlayers", 0, "player1Side", side, "player2Side", 1 - side);
    socket.room = nameOfRoom;

    io.to(socket.id).emit('generated', nameOfRoom);
  });

  socket.on('join', function (nameOfRoom) {

    pubClient.hget(nameOfRoom, "numbOfPlayers").then(value => {
      if(value!=null && value < 2){
        console.log(nameOfRoom + " : has joined in ");
      io.to(socket.id).emit('joined');
      socket.room = nameOfRoom;
      }else{
        io.to(socket.id).emit('errorJoining');
      }
    }).catch(err => {
      console.log('Error:', err);
    });
  });

  socket.on('enterLobby', function () {
    pubClient.hgetall(nameOfRoom).then(value => {
      if(value!=null && value.numbOfPlayers < 2){
        pubClient.hset(nameOfRoom, "numbOfPlayers", value.numbOfPlayers+1)
        socket.join(socket.room);
        
        if(value.player1Id!=null) {
          pubClient.hset(nameOfRoom, "player2Id", socket.id)
          io.to(socket.id).emit('side', value.player2Side);
        }
        if(value.player2Id!=null) {
          pubClient.hset(nameOfRoom, "player1Id", socket.id)
          io.to(socket.id).emit('side', value.player1Side);
        }
        if (value.numbOfPlayers == 2) {
          io.to(socket.room).emit('canPlay', true);
        } else {
          io.to(socket.room).emit('canPlay', false);
        }
      }
    }).catch(err => {
      console.log('Error:', err);
    });
  });

  socket.on('enterGame', function () {
    if (!lobbies[socket.room]) { return; }
    if (isPlayer("player1", socket)) {
      lobbies[socket.room].player1.enteredGame = true;
    } else if (isPlayer("player2", socket)) {
      lobbies[socket.room].player2.enteredGame = true;
    }
    if (lobbies[socket.room] && !lobbies[socket.room].forcedGameStarted) {
      forcedGameStart(socket.room);
      lobbies[socket.room].forcedGameStarted = true;
    }
  });

  socket.on('random', function (levelRange) {
    let foundLobby = false;

    for (let i = 0; i < randoms.length; i++) {
      if (randoms[i][0] == levelRange) {
        socket.room = randoms[i][1];
        foundLobby = true;
        randoms.splice(i, 1);
      }
    }

    if (!foundLobby) {
      let nameOfRoom = makeid(12);
      console.log(nameOfRoom + " : is created ");

      lobbies[nameOfRoom] = { "numbOfPlayers": 0 };
      lobbies[nameOfRoom].player1 = { "ready": false, "Rwon": 0 };
      lobbies[nameOfRoom].player2 = { "ready": false, "Rwon": 0 };
      lobbies[nameOfRoom].round = 1;
      lobbies[nameOfRoom].random = true;
      lobbies[nameOfRoom].levelRange = levelRange;

      let side = Math.floor(Math.random() * 2);
      lobbies[nameOfRoom].player1.side = side;
      lobbies[nameOfRoom].player2.side = 1 - side;

      socket.room = nameOfRoom;
      randoms.push([levelRange, nameOfRoom]);
    }

  });

  socket.on('ready', function (x, y) {
    console.log(x, y);

    if (!lobbies[socket.room]) { return; }
    if (isPlayer("player1", socket)) {
      console.log("player1 ready");
      lobbies[socket.room].player1.ready = true;
      lobbies[socket.room].player1.x_start = x;
      lobbies[socket.room].player1.y_start = y;
    } else {
      console.log("player2 ready");
      lobbies[socket.room].player2.ready = true;
      lobbies[socket.room].player2.x_start = x;
      lobbies[socket.room].player2.y_start = y;
    }

    if (lobbies[socket.room].player1.ready && lobbies[socket.room].player2.ready) {
      io.to(socket.room).emit("startGame");
      lobbies[socket.room].gameStarted = true;

      initVariables(socket.room);
      startingPosition(lobbies[socket.room].player1, lobbies[socket.room].player2);
      playing(socket.room);
    }
  });

  socket.on('turnRight', function () {
    if (!lobbies[socket.room]) { return; }
    let player;

    if (lobbies[socket.room].player1.id == socket.id) {
      player = "player1";
    } else {
      player = "player2";
    }

    const last = lobbies[socket.room][player].variables.length - 1;

    let orientation = lobbies[socket.room][player].variables[last][3];

    orientation += 90;
    if (orientation == 270) {
      orientation = -90;
    }
    if (lobbies[socket.room][player].variables[last][2] - lobbies[socket.room][player].variables[last][1] > snakeWidth + 2) {
      let rectangle = [];

      rectangle[0] = lobbies[socket.room][player].variables[last][1];
      rectangle[1] = -lobbies[socket.room][player].variables[last][0] - snakeWidth;
      rectangle[2] = -lobbies[socket.room][player].variables[last][0] - snakeWidth;
      rectangle[3] = orientation;

      lobbies[socket.room][player].variables.push(rectangle);
    }
  });

  socket.on('turnLeft', function () {
    if (!lobbies[socket.room]) { return; }
    let player;

    if (lobbies[socket.room].player1.id == socket.id) {
      player = "player1";
    } else {
      player = "player2";
    }

    const last = lobbies[socket.room][player].variables.length - 1;

    let orientation = lobbies[socket.room][player].variables[last][3];

    orientation -= 90;
    if (orientation == -180) {
      orientation = 180;
    }

    if (lobbies[socket.room][player].variables[last][2] - lobbies[socket.room][player].variables[last][1] > snakeWidth + 2) {
      let rectangle = [];

      rectangle[0] = -lobbies[socket.room][player].variables[last][1] - snakeWidth;
      rectangle[1] = lobbies[socket.room][player].variables[last][0];
      rectangle[2] = lobbies[socket.room][player].variables[last][0];
      rectangle[3] = orientation;

      lobbies[socket.room][player].variables.push(rectangle);
    }
  });

});

function makeid(length) {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;

  while (lobbies[result] || result === '') {
    result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
  }
  return result;
}

function forcedGameStart(room) {
  timeout = setTimeout(() => {
    if (lobbies[room]) {
      if (!lobbies[room].gameStarted && lobbies[room].numbOfPlayers == 2 &&
        (!lobbies[room].player1.ready || !lobbies[room].player2.ready)
      ) {
        console.log("game force start");
        if (!lobbies[room].player1.ready) {
          lobbies[room].player1.x_start = defaultStartingX;
          lobbies[room].player1.y_start = 1 - lobbies[room].player1.side;
        }

        if (!lobbies[room].player2.ready) {
          lobbies[room].player2.x_start = defaultStartingX;
          lobbies[room].player2.y_start = 1 - lobbies[room].player2.side;
        }

        io.to(room).emit("startGame");
        lobbies[room].gameStarted = true;

        initVariables(room);
        startingPosition(lobbies[room].player1, lobbies[room].player2);
        playing(room);
      }
      if (!lobbies[room].player1.enteredGame || !lobbies[room].player2.enteredGame) {
        quitGame(room);
      }
    }
  }, MAX_TIME_START_GAME);
}

function initVariables(room) {
  lobbies[room].player1.variables = [];
  lobbies[room].player2.variables = [];
  lobbies[room].player1.bumpToSelf = false;
  lobbies[room].player2.bumpToSelf = false;
  lobbies[room].player1.ready = false;
  lobbies[room].player2.ready = false;
  lobbies[room].finished = false;
  clearTimeout(timeout);
}

function forcedRoundStart(room) {
  timeout = setTimeout(() => {
    if (lobbies[room]) {
      if (!lobbies[room].gameStarted) {

        io.to(room).emit("startGame");
        lobbies[room].gameStarted = true;

        initVariables(room);
        startingPosition(lobbies[room].player1, lobbies[room].player2);
        playing(room);
      }
    }

  }, MAX_TIME_START_ROUND);
}

function startingPosition(player1, player2) {
  player1Rectangle = startingRectangle(player1.x_start, player1.y_start);

  player1.variables.push(player1Rectangle);

  player2Rectangle = startingRectangle(player2.x_start, player2.y_start);

  player2.variables.push(player2Rectangle);
}

function startingRectangle(x, y) {
  let angle = 0;
  let rectangle = [];

  if (y === 0) {
    angle = 180;
    if (x <= barWidth + snakeWidth) {
      x = barWidth + 1 + snakeWidth;
    }
    if (x >= width - barWidth) {
      x = width - barWidth - 1;
    }
  } else if (x === 0) {
    angle = 90;
    if (y >= height - barWidth - snakeWidth) {
      y = height - barWidth - 1 - snakeWidth;
    }
    if (y <= barWidth) {
      y = barWidth + 1;
    }
  } else if (x == width) {
    angle = -90;
    if (y >= height - barWidth) {
      y = height - barWidth - 1;
    }
    if (y <= barWidth + snakeWidth) {
      y = barWidth + 1 + snakeWidth;
    }
  } else {
    if (x <= barWidth) {
      x = barWidth + 1;
    }
    if (x >= width - barWidth - snakeWidth) {
      x = width - barWidth - 1 - snakeWidth;
    }
  }

  switch (angle) {
    case 0:
      rectangle[0] = x;
      rectangle[1] = height - 10;
      rectangle[2] = height;
      break;
    case 180:
      rectangle[0] = -x;
      rectangle[1] = -10;
      rectangle[2] = 0;
      break;
    case 90:
      rectangle[0] = y;
      rectangle[1] = -10;
      rectangle[2] = 0;
      break;
    default:
      rectangle[0] = -y;
      rectangle[1] = x - 10;
      rectangle[2] = x;
      break;

  }
  rectangle[3] = angle;

  return rectangle;
}
function playing(room) {
  if (!lobbies[room]) { return; }
  if (lobbies[room].finished) { return; }
  setTimeout(() => {
    if (lobbies[room]) {
      const player1Last = lobbies[room].player1.variables.length - 1;
      const player2Last = lobbies[room].player2.variables.length - 1;

      lobbies[room].player1.variables[player1Last][1] -= 4;
      lobbies[room].player2.variables[player2Last][1] -= 4;

      io.to(lobbies[room].player1.id).emit('update', [lobbies[room].player1, lobbies[room].player2]);
      io.to(lobbies[room].player2.id).emit('update', [lobbies[room].player2, lobbies[room].player1]);

      checking(room);
      playing(room);
    }
  }, 15);

}

function checking(room) {
  if (!lobbies[room]) { return; }
  let player1Won = false;
  let player2Won = false;

  const player1Variables = lobbies[room].player1.variables;
  const player1Checker = getChecker(player1Variables[player1Variables.length - 1]);

  const player2Variables = lobbies[room].player2.variables;
  const player2Checker = getChecker(player2Variables[player2Variables.length - 1]);

  for (let i = 0; i < player1Variables.length; i++) {

    const rect = getRect(player1Variables[i]);
    if (intersects(player1Checker, rect) && i < player1Variables.length - 1) {

      if (!lobbies[room].player1.bumpToSelf) {
        lobbies[room].player1.bumpToSelf = true;
        removeRects(player1Variables, i, player1Checker);
      } else {
        player2Won = true;
      }
    }
    if (intersects(player2Checker, rect)) {
      player1Won = true;
    }
  }

  for (let i = 0; i < player2Variables.length; i++) {

    rect = getRect(player2Variables[i]);
    if (intersects(player2Checker, rect) && i < player2Variables.length - 1) {

      if (!lobbies[room].player2.bumpToSelf) {
        lobbies[room].player2.bumpToSelf = true;
        removeRects(player2Variables, i, player2Checker);
      } else {
        player1Won = true;
      }
    }
    if (intersects(player1Checker, rect)) {
      player2Won = true;
    }
  }

  if (hitBorder(player1Checker, lobbies[room].player1.variables)) {
    player2Won = true;
  }

  if (hitBorder(player2Checker, lobbies[room].player2.variables)) {
    player1Won = true;
  }

  if (player1Won && player2Won) {
    io.sockets.to(room).emit('draw');
    lobbies[room].finished = true;
  } else if (player1Won) {
    io.to(lobbies[room].player1.id).emit('won');
    io.to(lobbies[room].player2.id).emit('lost');
    lobbies[room].finished = true;
    lobbies[room].player1.Rwon += 1;
  } else if (player2Won) {
    io.to(lobbies[room].player2.id).emit('won');
    io.to(lobbies[room].player1.id).emit('lost');
    lobbies[room].finished = true;
    lobbies[room].player2.Rwon += 1;
  }

  if (lobbies[room].finished) {
    whenGameFinished(room);
  }
}

function intersects(rect1, rect2) {

  return rect1[0] < rect2[2] && rect1[2] > rect2[0] && rect1[1] < rect2[3] && rect1[3] > rect2[1];

}

function hitBorder(checker, rectangles) {
  const Hitborder = intersects(checker, leftEdge) || intersects(checker, rigthEdge) ||
    intersects(checker, topEdge) || intersects(checker, botEdge);
  const last = rectangles.length - 1;
  const lastRectangleLength = rectangles[last][2] - rectangles[last][1];

  return Hitborder && (lastRectangleLength > barWidth || rectangles.length > 1);
}

function removeRects(rectangles, i, checker) {

  const rectsToRemove = rectangles.length - i - 1;
  for (let remove = 0; remove < rectsToRemove; remove++) {
    rectangles.pop();
  }

  if (rectangles[i][3] == 90) {
    rectangles[i][1] = -checker[0];
  } else if (rectangles[i][3] == -90) {
    rectangles[i][1] = checker[0];
  } else if (rectangles[i][3] == 180) {
    rectangles[i][1] = -checker[1];
  } else if (rectangles[i][3] === 0) {
    rectangles[i][1] = checker[1];
  }

}

function getChecker(rectangle) {
  const left = rectangle[0];
  const top = rectangle[1];
  let checker = [];

  switch (rectangle[3]) {
    case 90:
      checker = [-top - 1, left, -top, left + snakeWidth];
      break;
    case -90:
      checker = [top, -left - snakeWidth, top - 1, -left];
      break;
    case 180:
      checker = [-left - snakeWidth, -top - 1, -left, -top];
      break;
    default:
      checker = [left, top, left + snakeWidth, top + 1];
      break;
  }

  return checker;
}

function getRect(rectangle) {
  const left = rectangle[0];
  const top = rectangle[1];
  const bot = rectangle[2];
  let rect = [];

  switch (rectangle[3]) {
    case 90:
      rect = [-bot, left, -top, left + snakeWidth];
      break;
    case -90:
      rect = [top, -left - snakeWidth, bot, -left];
      break;
    case 180:
      rect = [-left - snakeWidth, -bot, -left, -top];
      break;
    default:
      rect = [left, top, left + snakeWidth, bot];
      break;
  }

  return rect;
}

function isPlayer(player, socket) {
  return lobbies[socket.room][player].id == socket.id;
}

function whenGameFinished(room) {
  lobbies[room].gameStarted = false;
  setTimeout(async () => {
    if (!lobbies[room]) { return; }
    if (lobbies[room].gameStarted) { return; }
    lobbies[room].round += 1;
    const wonTwoRounds = Math.abs(lobbies[room].player1.Rwon - lobbies[room].player2.Rwon) == 2;

    if (lobbies[room].round > 3 || wonTwoRounds) {
      io.to(lobbies[room].player1.id).emit('gameFinished', lobbies[room].player1.Rwon, lobbies[room].player2.Rwon);
      io.to(lobbies[room].player2.id).emit('gameFinished', lobbies[room].player2.Rwon, lobbies[room].player1.Rwon);
      const sockets = await io.in(room).fetchSockets();
      sockets.forEach(socket => {
        socket.leave(room)
      });
      delete lobbies[room];
    } else {
      io.sockets.to(room).emit('roundFinished', lobbies[room].round);
      forcedRoundStart(room);
    }
  }, MAX_TIME_START_ROUND);
}

function quitWaiting(socket) {
  console.log('user quit lobby');
  if (!lobbies[socket.room]) { return; }
  lobbies[socket.room].numbOfPlayers -= 1;
  if (isPlayer('player1', socket)) {
    delete lobbies[socket.room].player1.id;
  } else if (isPlayer('player2', socket)) {
    delete lobbies[socket.room].player2.id;
  }
  if (lobbies[socket.room].numbOfPlayers === 0) {
    deleteIfRandom(socket.room);
    delete lobbies[socket.room];
  } else {
    if (lobbies[socket.room].gameStarted) {
      socket.to(socket.room).emit('gameEnded');
      lobbies[socket.room].finished = true;
      delete lobbies[socket.room];
    } else {
      socket.to(socket.room).emit('canPlay', false);
      if (lobbies[socket.room].random) {
        randoms.push([lobbies[socket.room].levelRange, socket.room]);
      }
    }
  }
  socket.leave(socket.room);

}

async function quitGame(room) {
  console.log('user quit game');
  if (!lobbies[room]) { return; }
  lobbies[room].finished = true;

  const sockets = await io.in(room).fetchSockets();
  sockets.forEach(socket => {
    socket.leave(room)
  });
  delete lobbies[room];
}

function deleteIfRandom(room) {
  if (!lobbies[room].random) { return; }
  for (let i = 0; i < randoms.length; i++) {
    if (randoms[i][1] == room) {
      randoms.splice(i, 1);
    }
  }
}

