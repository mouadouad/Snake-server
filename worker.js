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