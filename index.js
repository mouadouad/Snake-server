// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var rooms = [];
var lobbies = {};
var randoms = [];
var width=1080;
var height=1770;
//SET EDGES RECTS
let leftEdge=[0,0,20,1600];
let rigthEdge=[width-20,0,width,1600];
let topEdge=[0,0,width,20];
let botEdge = [0, 1580, width, 1600];
let default_starting_x = 0.5;
server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

io.on('connection', (socket) => {
  console.log('user connected');
  
      socket.on('ping', function() {
        io.to(socket.id).emit('pong');
      });

      socket.on('quit', function () {
          //IF PLAYER QUITS
          console.log('user quit');
          socket.to(socket.room).emit('quit');
          //DELETE ROOM
          delete lobbies[socket.room];
          for (var i = 0; i < rooms.length; i++) { if (rooms[i] === socket.room) { rooms.splice(i, 1); i--; } }
          for (var a = 0; a < randoms.length; a++) { if (randoms[a][1] === socket.room) { randoms.splice(a, 1); a--; } }
          socket.leave(socket.room);
        });
     
      socket.on('destroy', function() {
     //DELETE ROOM
          delete lobbies[socket.room];
          for( var i = 0; i < rooms.length; i++){ if ( rooms[i] === socket.room) { rooms.splice(i, 1); i--; }}
          for( var a = 0; a < randoms.length; a++){ if ( randoms[a][1] === socket.room) { randoms.splice(a, 1); a--; }}          
          socket.leave(socket.room);
      });
  
      socket.on('create', function(nameOfRoom) {

        if(!rooms.includes(nameOfRoom)){ //check if room already exists
        console.log(nameOfRoom +" : is created "  );
        
        rooms.push(nameOfRoom); //add new room to room arrays
        socket.join(nameOfRoom); //join room
        socket.room=nameOfRoom;
        let room = {'joined':0};//set the room array and set the joined player to 0
        lobbies[nameOfRoom]=room;//add the room array to the lobbies json
        io.to(socket.id).emit('created',true);//emit that room is created

        }
        
    });

      socket.on('join', function(nameOfRoom) {
        
        if(rooms.includes(nameOfRoom)&&lobbies[nameOfRoom].joined===0){ //check if room exists and no one already joined
             console.log(nameOfRoom +" : has joined in "  );
             
          lobbies[nameOfRoom].joined=1;//say to array that i joined
          socket.join(nameOfRoom); //join room
          socket.room=nameOfRoom;
          socket.to(socket.room).emit('entred',true);//emit that I entred
          io.to(socket.id).emit('entred1',true);
          
                //!!!playerlobbies[nameOfRoom]1 is creater !!player2 is the joined 
          //choose which side
          let side = Math.floor(Math.random() * 2);
          io.sockets.to(socket.room).emit('side',side);//emit that I entred

          //INTIALIZE READY VARIABLES
        let player1={"ready":0};
        lobbies[nameOfRoom].player1=player1;
        let player2={"ready":0};
        lobbies[nameOfRoom].player2=player2;
        lobbies[socket.room].round =1;

            //IF 10 SECONDS OF WAITING OF CHOOSING IF FINISHED
            setTimeout(() => {

                if (lobbies[socket.room] != null) {
                    if (lobbies[socket.room].player1.ready === 0 || lobbies[socket.room].player2.ready === 0) {
                        if (lobbies[socket.room].player1.ready === 0) {
                            //PLAYER1 WHO CREATED IS READY
                            lobbies[socket.room].player1.ready = 1;
                            lobbies[socket.room].player1.x_start = default_starting_x;
                            var default_starting_y;
                            if (side == 1) { default_starting_y = 0 } else { default_starting_y = 1 }
                            lobbies[socket.room].player1.y_start = default_starting_y;

                        }


                        if (lobbies[socket.room].player2.ready === 0) {
                            //PLAYER2 WHO JOINED IS READY
                            lobbies[socket.room].player2.ready = 1;
                            lobbies[socket.room].player2.x_start = default_starting_x;

                            var default_starting_y;
                            if (1 - side == 1) { default_starting_y = 0 } else { default_starting_y = 1 }
                            lobbies[socket.room].player2.y_start = default_starting_y;

                        }

                        io.sockets.to(socket.room).emit('readyBack', lobbies[socket.room]);
                        //INTIALIZE COUNTERS AND VARIABLES ARRAYS AND BOOLEANS
                        let variables1 = [];
                        let variables2 = [];

                        lobbies[socket.room].player1.counter = 1;
                        lobbies[socket.room].player1.variables = variables1;
                        lobbies[socket.room].player2.counter = 1;
                        lobbies[socket.room].player2.variables = variables2;
                        lobbies[socket.room].player1.firstBump = 0;
                        lobbies[socket.room].player2.firstBump = 0;
                        lobbies[socket.room].player1.bumpToSelf = 0;
                        lobbies[socket.room].player2.bumpToSelf = 0;
                        lobbies[socket.room].stillTravelling = true;
                        lobbies[socket.room].finished = false;
                        start_position(lobbies[socket.room].player1.x_start * width, lobbies[socket.room].player1.y_start * height, lobbies[socket.room].player2.x_start * width, lobbies[socket.room].player2.y_start * height);
                        playing();

                    }
                }

            }, 10000);
          
          
        }
        
    });
      
      socket.on('random', function(range) {
        
        var searching = true;
        var i=0;
        var found=false;
        while(searching&&i<randoms.length&&!found){
          
          if(randoms[i][0]==range){
            found=true;
            //JOIN
            socket.join(randoms[i][1]); //join room
            socket.room=randoms[i][1];
            let room = {'joined':1};//set the room array and set the joined player to 0
            lobbies[randoms[i][1]]=room;//add the room array to the lobbies json
            let side = Math.floor(Math.random() * 2);
            io.sockets.to(socket.room).emit('side',side);//emit that I entred
            socket.to(randoms[i][1]).emit('player_found', true);
            io.to(socket.id).emit('game_found', true);
            
            //INTIALIZE READY VARIABLES
            let player1={"ready":0};
            lobbies[socket.room].player1=player1;
            let player2={"ready":0};
            lobbies[socket.room].player2=player2;
            lobbies[socket.room].round =1;
            
              randoms.splice(i, 1);

              //IF 10 SECONDS OF WAITING OF CHOOSING IF FINISHED
              setTimeout(() => {

                  if (lobbies[socket.room] != null) {

                      if (lobbies[socket.room].player1.ready === 0 || lobbies[socket.room].player2.ready === 0) {

                          if (lobbies[socket.room].player1.ready === 0) {
                              //PLAYER1 WHO CREATED IS READY
                              lobbies[socket.room].player1.ready = 1;
                              lobbies[socket.room].player1.x_start = default_starting_x;
                              var default_starting_y;
                              if (side == 1) { default_starting_y = 0 } else { default_starting_y = 1 }
                              lobbies[socket.room].player1.y_start = default_starting_y;

                          }


                          if (lobbies[socket.room].player2.ready === 0) {
                              //PLAYER2 WHO JOINED IS READY
                              lobbies[socket.room].player2.ready = 1;
                              lobbies[socket.room].player2.x_start = default_starting_x;

                              var default_starting_y;
                              if (1 - side == 1) { default_starting_y = 0 } else { default_starting_y = 1 }
                              lobbies[socket.room].player2.y_start = default_starting_y;

                          }

                          io.sockets.to(socket.room).emit('readyBack', lobbies[socket.room]);
                          //INTIALIZE COUNTERS AND VARIABLES ARRAYS AND BOOLEANS
                          let variables1 = [];
                          let variables2 = [];

                          lobbies[socket.room].player1.counter = 1;
                          lobbies[socket.room].player1.variables = variables1;
                          lobbies[socket.room].player2.counter = 1;
                          lobbies[socket.room].player2.variables = variables2;
                          lobbies[socket.room].player1.firstBump = 0;
                          lobbies[socket.room].player2.firstBump = 0;
                          lobbies[socket.room].player1.bumpToSelf = 0;
                          lobbies[socket.room].player2.bumpToSelf = 0;
                          lobbies[socket.room].stillTravelling = true;
                          lobbies[socket.room].finished = false;
                          start_position(lobbies[socket.room].player1.x_start * width, lobbies[socket.room].player1.y_start * height, lobbies[socket.room].player2.x_start * width, lobbies[socket.room].player2.y_start * height);
                          playing();

                      }
                  }

              }, 10000);
          }
          i++;
        }
        
        if(!found){
            //CREATE
            var id = makeid(12);
          randoms.push([range,id]);
          socket.join(id); //join room
          socket.room=id;
        }
        
      });

      function makeid(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
      
      socket.on('ready', function(x,y,player) {
 
       if(player=="player1"){
        console.log("create ready");
        //PLAYER1 WHO CREATED IS READY
        lobbies[socket.room].player1.ready=1;
        lobbies[socket.room].player1.x_start=x;
        lobbies[socket.room].player1.y_start=y;
       }else{
        console.log("join ready");
       //PLAYER2 WHO JOINED IS READY
        lobbies[socket.room].player2.ready=1;
        lobbies[socket.room].player2.x_start=x;
        lobbies[socket.room].player2.y_start=y;
       }
      
       io.sockets.to(socket.room).emit('readyBack',lobbies[socket.room]);
       
       if(lobbies[socket.room].player1.ready===1&&lobbies[socket.room].player2.ready===1){ //IF BOTH PLAYERS ARE READY TO START 
        
        //INTIALIZE COUNTERS AND VARIABLES ARRAYS AND BOOLEANS
        let variables1=[];
        let variables2=[];

        lobbies[socket.room].player1.counter=1;
        lobbies[socket.room].player1.variables=variables1;
        lobbies[socket.room].player2.counter=1;
        lobbies[socket.room].player2.variables=variables2;
        lobbies[socket.room].player1.firstBump =0;
        lobbies[socket.room].player2.firstBump =0;
        lobbies[socket.room].player1.bumpToSelf =0;
        lobbies[socket.room].player2.bumpToSelf =0;
        lobbies[socket.room].stillTravelling=true;
        lobbies[socket.room].finished=false;
        start_position(lobbies[socket.room].player1.x_start*width,lobbies[socket.room].player1.y_start*height,lobbies[socket.room].player2.x_start*width,lobbies[socket.room].player2.y_start*height);
        playing();
        
       }
    });
      
      function start_position(X_start,Y_start,x2_start,y2_start){

      //GET START POSITION FOR PLAYERS
      
        var lastposition=0;
        var first_rect_postition=[];

          // TO SEE WHAT ANGLE START WITH
        if (Y_start===0){
            lastposition=180;
            if(X_start<=20+30){X_start=20+1+30;}
            if(X_start>=1060){X_start=1060-1;}      

        }else if (X_start===0){
            lastposition =90;
            if(Y_start>=1580-30){Y_start=1580-1-30;}
            if(Y_start<=20){Y_start=20+1;}
        }else if (X_start==width){
            lastposition=-90;
            if(Y_start>=1580){Y_start=1580-1;}
            if(Y_start<=20+30){Y_start=20+1+30;}
        }else{
          if(X_start<=20){X_start=20+1;}
          if(X_start>=1060-30){X_start=1060-1-30;}
        }

        if(lastposition===0){
          first_rect_postition[0]=  X_start;
          first_rect_postition[1]=  1600-10;
          first_rect_postition[2]=  1600;
        }else if(lastposition==180){
          first_rect_postition[0]=  -X_start;
          first_rect_postition[1]=  -10;
          first_rect_postition[2]=  0;
        }else if(lastposition==90){
          first_rect_postition[0]=  Y_start;
          first_rect_postition[1]= -10;
          first_rect_postition[2]=  0;
        }else{
          first_rect_postition[0]=  -Y_start;
          first_rect_postition[1]=  X_start-10;
          first_rect_postition[2]=  X_start;
        }
        first_rect_postition[3]=lastposition;
        
        lobbies[socket.room].player1.variables.push(first_rect_postition);
      
        // TO SEE WHAT ANGLE START WITH
        var lastposition1=0;
        
        if (y2_start===0){
            lastposition1=180;
            if(x2_start<=20+30){x2_start=20+1+30;}
            if(x2_start>=1060){x2_start=1060-1;}
        }else if (x2_start===0){
            lastposition1 =90;
            if(y2_start>=1580-30){y2_start=1580-1-30;}
            if(y2_start<=30){y2_start=20+1;}
        }else if (x2_start==width){
            lastposition1=-90;
            if(y2_start>=1580){y2_start=1580-1;}
            if(y2_start<=20+30){y2_start=20+1+30;}
        }else{
          if(x2_start<=20){x2_start=20+1;}
          if(x2_start>=1060-30){x2_start=1060-1-30;}
        }

        var first_rect_postition1=[];

        if(lastposition1===0){
          first_rect_postition1[0]=  x2_start;
          first_rect_postition1[1]=  1600-10;
          first_rect_postition1[2]=  1600;
        }else if(lastposition1==180){
          first_rect_postition1[0]=  -x2_start;
          first_rect_postition1[1]=  -10;
          first_rect_postition1[2]=  0;
        }else if(lastposition1==90){
          first_rect_postition1[0]=  y2_start;
          first_rect_postition1[1]= -10;
          first_rect_postition1[2]=  0;
        }else{
          first_rect_postition1[0]=  -y2_start;
          first_rect_postition1[1]=  x2_start-10;
          first_rect_postition1[2]=  x2_start;
        }
          first_rect_postition1[3]=lastposition1;

       lobbies[socket.room].player2.variables.push(first_rect_postition1);
        
        
      }
      
      socket.on('turn_right', function(player) {
        
        if(player=="player1"){
          
          let counter1=lobbies[socket.room].player1.counter;
          
          var lastposition=lobbies[socket.room].player1.variables[counter1-1][3];

        if (lastposition === 0) {
            lastposition = 90;
        } else if (lastposition == 180) {
            lastposition = -90;
        }else if (lastposition==-90){lastposition=0;
        }else if (lastposition==90){
            lastposition=180;}



        var first_rect_postition=[];

        first_rect_postition[0]= lobbies[socket.room].player1.variables[counter1-1][1];
        first_rect_postition[1]= -lobbies[socket.room].player1.variables[counter1-1][0]-30;
        first_rect_postition[2]= -lobbies[socket.room].player1.variables[counter1-1][0]-30;
        first_rect_postition[3]=lastposition;


            lobbies[socket.room].player1.variables.push(first_rect_postition);
            lobbies[socket.room].player1.counter+=1;
            
        }else{
          let counter1=lobbies[socket.room].player2.counter;
          
         var  lastposition1=lobbies[socket.room].player2.variables[counter1-1][3];

        if (lastposition1 === 0) {
            lastposition1 = 90;
        } else if (lastposition1 == 180) {
            lastposition1 = -90;
        }else if (lastposition1==-90){lastposition1=0;
        }else if (lastposition1==90){
            lastposition1=180;}



        var first_rect_postition1=[];

        first_rect_postition1[0]= lobbies[socket.room].player2.variables[counter1-1][1];
        first_rect_postition1[1]= -lobbies[socket.room].player2.variables[counter1-1][0]-30;
        first_rect_postition1[2]= -lobbies[socket.room].player2.variables[counter1-1][0]-30;
        first_rect_postition1[3]=lastposition1;


            lobbies[socket.room].player2.variables.push(first_rect_postition1);
            lobbies[socket.room].player2.counter+=1;
            
          
          
        }
        
        });
       
      socket.on('turn_left', function(player) {
        
        if(player=="player1"){
          
          let counter1=lobbies[socket.room].player1.counter;
          
          var lastposition=lobbies[socket.room].player1.variables[counter1-1][3];

          //FIND ANGLE
        if (lastposition === 0) {
            lastposition = -90;
        } else if (lastposition == 180) {
            lastposition = 90;
        } else if (lastposition == -90) {
            lastposition = 180;
        } else if (lastposition == 90) {
            lastposition = 0;
        }


        var first_rect_postition=[];
    
        first_rect_postition[0] = -lobbies[socket.room].player1.variables[counter1-1][1]- 30;
        first_rect_postition[1] = lobbies[socket.room].player1.variables[counter1-1][0];
        first_rect_postition[2] = lobbies[socket.room].player1.variables[counter1-1][0];
        first_rect_postition[3] = lastposition;

            //ADD NEW ARRAY FOR RECT
            lobbies[socket.room].player1.variables.push(first_rect_postition);
            lobbies[socket.room].player1.counter+=1;
            
        }else{
         
          let counter1=lobbies[socket.room].player2.counter;
          
          var lastposition1=lobbies[socket.room].player2.variables[counter1-1][3];

          //FIND ANGLE
        if (lastposition1 === 0) {
            lastposition1 = -90;
        } else if (lastposition1 == 180) {
            lastposition1 = 90;
        } else if (lastposition1 == -90) {
            lastposition1 = 180;
        } else if (lastposition1 == 90) {
            lastposition1 = 0;
        }

        var first_rect_postition1=[];
        
        first_rect_postition1[0] = -lobbies[socket.room].player2.variables[counter1-1][1]- 30;
        first_rect_postition1[1] = lobbies[socket.room].player2.variables[counter1-1][0];
        first_rect_postition1[2] = lobbies[socket.room].player2.variables[counter1-1][0];
        first_rect_postition1[3] = lastposition1;

            //ADD NEW ARRAY FOR RECT
            lobbies[socket.room].player2.variables.push(first_rect_postition1);
            lobbies[socket.room].player2.counter+=1;
          
        }
        
        });
      
      function playing(){
        
        //MAIN LOOP FOR PLAYING 
              
        while(lobbies[socket.room].stillTravelling&&!lobbies[socket.room].finished){
          
           lobbies[socket.room].stillTravelling=false;
        
        setTimeout(() => {
            if (lobbies[socket.room] != null) {

                let counter1 = lobbies[socket.room].player1.counter;
                let counter2 = lobbies[socket.room].player2.counter;

                lobbies[socket.room].player1.variables[counter1 - 1][1] -= 2;
                lobbies[socket.room].player2.variables[counter2 - 1][1] -= 2;

                io.sockets.to(socket.room).emit('repeat', lobbies[socket.room]);

                lobbies[socket.room].stillTravelling = true;
                checking();
                playing();
            }
          }, 10);
          
        }
        
      }
      
      function checking(){
        
        var player1Won=false;
        var player2Won=false;
        
        //player1 checker
        let counter1=lobbies[socket.room].player1.counter;
        let GAUCHE =lobbies[socket.room].player1.variables[counter1-1][0];
        let HAUT =lobbies[socket.room].player1.variables[counter1-1][1];
        
        let checker=[];
        
        if (lobbies[socket.room].player1.variables[counter1-1][3]==90){
            checker=[-HAUT-1, GAUCHE,-HAUT, GAUCHE +30];
        }else if (lobbies[socket.room].player1.variables[counter1-1][3]==-90){
            checker=[HAUT,-GAUCHE -30, HAUT-1,-GAUCHE];
        }else if (lobbies[socket.room].player1.variables[counter1-1][3]==180){
            checker=[-GAUCHE -30,-HAUT-1,-GAUCHE,-HAUT];
        }else if (lobbies[socket.room].player1.variables[counter1-1][3]===0){
            checker=[GAUCHE, HAUT, GAUCHE +30, HAUT+1];
        }
        
        //player2 checker
        let counter2=lobbies[socket.room].player2.counter;
        let GAUCHE1 =lobbies[socket.room].player2.variables[counter2-1][0];
        let HAUT1 =lobbies[socket.room].player2.variables[counter2-1][1];
        
        let checker1=[];
        
        if (lobbies[socket.room].player2.variables[counter2-1][3]==90){
            checker1=[-HAUT1-1, GAUCHE1,-HAUT1, GAUCHE1 +30];
        }else if (lobbies[socket.room].player2.variables[counter2-1][3]==-90){
            checker1=[HAUT1,-GAUCHE1 -30, HAUT1-1,-GAUCHE1];
        }else if (lobbies[socket.room].player2.variables[counter2-1][3]==180){
            checker1=[-GAUCHE1 -30,-HAUT1-1,-GAUCHE1,-HAUT1];
        }else if (lobbies[socket.room].player2.variables[counter2-1][3]===0){
            checker1=[GAUCHE1, HAUT1, GAUCHE1 +30, HAUT1+1];
        }
            
        //SET PLAYER1 RECTS
         for (var forloop = 0; forloop<lobbies[socket.room].player1.counter; forloop++){

            let LEFT =lobbies[socket.room].player1.variables[forloop][0];
            let TOP =lobbies[socket.room].player1.variables[forloop][1];
            let BOT =lobbies[socket.room].player1.variables[forloop][2];

            var rect1=[];

            if (lobbies[socket.room].player1.variables[forloop][3]==90){
                rect1=[-BOT, LEFT,-TOP, LEFT +30];
            }else if (lobbies[socket.room].player1.variables[forloop][3]==-90){
                rect1=[TOP,-LEFT -30, BOT,-LEFT];
            }else if (lobbies[socket.room].player1.variables[forloop][3]==180){
                rect1=[-LEFT -30,-BOT,-LEFT,-TOP];
            }else if (lobbies[socket.room].player1.variables[forloop][3]===0){
                rect1=[LEFT, TOP, LEFT +30, BOT];
            }
            
            //IF BUMP TO MYSELF
            if(checker[0]<rect1[2]&&checker[2]>rect1[0]&&checker[1]<rect1[3]&&checker[3]>rect1[1]&&forloop<lobbies[socket.room].player1.counter-1){
              
              if(lobbies[socket.room].player1.bumpToSelf===0){
                lobbies[socket.room].player1.bumpToSelf=1;
              //REMOVE ALL THE RECTS AFTER THE ONE PLAYER1 BUMPED INTO
                for (var remove=0;remove<counter1-1-forloop;remove++){
                    lobbies[socket.room].player1.variables.pop();
                }
                lobbies[socket.room].player1.counter=forloop+1;
                   
                if (lobbies[socket.room].player1.variables[forloop][3]==90){
                lobbies[socket.room].player1.variables[forloop][1]=-checker[0];
            }else if (lobbies[socket.room].player1.variables[forloop][3]==-90){
                lobbies[socket.room].player1.variables[forloop][1]=checker[0];
            }else if (lobbies[socket.room].player1.variables[forloop][3]==180){
                lobbies[socket.room].player1.variables[forloop][1]=-checker[1];
            }else if (lobbies[socket.room].player1.variables[forloop][3]===0){
                lobbies[socket.room].player1.variables[forloop][1]=checker[1];
            }
  
              }else{
                player2Won=true;
              }
            }
            
            //IF BUMP TO OTHER PLAYER
            if(checker1[0]<rect1[2]&&checker1[2]>rect1[0]&&checker1[1]<rect1[3]&&checker1[3]>rect1[1]){
              player1Won=true;
            }
          
            
         }
            
        //SET PLAYER2 RECTS
         for (var forloop1 = 0; forloop1<lobbies[socket.room].player2.counter; forloop1++){
          
            let LEFT1 =lobbies[socket.room].player2.variables[forloop1][0];
            let TOP1 =lobbies[socket.room].player2.variables[forloop1][1];
            let BOT1 =lobbies[socket.room].player2.variables[forloop1][2];

            var rect2=[];

            if (lobbies[socket.room].player2.variables[forloop1][3]==90){
                rect2=[-BOT1, LEFT1,-TOP1, LEFT1 +30];
            }else if (lobbies[socket.room].player2.variables[forloop1][3]==-90){
                rect2=[TOP1,-LEFT1 -30, BOT1,-LEFT1];
            }else if (lobbies[socket.room].player2.variables[forloop1][3]==180){
                rect2=[-LEFT1 -30,-BOT1,-LEFT1,-TOP1];
            }else if (lobbies[socket.room].player2.variables[forloop1][3]===0){
                rect2=[LEFT1, TOP1, LEFT1 +30, BOT1];
            }
     
            //IF BUMP TO MYSELF
            if(checker1[0]<rect2[2]&&checker1[2]>rect2[0]&&checker1[1]<rect2[3]&&checker1[3]>rect2[1]&&forloop1<lobbies[socket.room].player2.counter-1){
              
              if(lobbies[socket.room].player2.bumpToSelf===0){
                lobbies[socket.room].player2.bumpToSelf=1;
              //REMOVE ALL THE RECTS AFTER THE ONE PLAYER2 BUMPED INTO
                for (var remove1=0;remove1<counter2-1-forloop1;remove1++){
                    lobbies[socket.room].player2.variables.pop();
                }

                lobbies[socket.room].player2.counter=forloop1+1;
               
                if (lobbies[socket.room].player2.variables[forloop1][3]==90){
                lobbies[socket.room].player2.variables[forloop1][1]=-checker1[0];
            }else if (lobbies[socket.room].player2.variables[forloop1][3]==-90){
                lobbies[socket.room].player2.variables[forloop1][1]=checker1[0];
            }else if (lobbies[socket.room].player2.variables[forloop1][3]==180){
                lobbies[socket.room].player2.variables[forloop1][1]=-checker1[1];
            }else if (lobbies[socket.room].player2.variables[forloop1][3]===0){
                lobbies[socket.room].player2.variables[forloop1][1]=checker1[1];
            }

              }else{
                player1Won=true;
              }
          
            }
            
            
            //IF BUMP TO OTHER PLAYER
            if(checker[0]<rect2[2]&&checker[2]>rect2[0]&&checker[1]<rect2[3]&&checker[3]>rect2[1]){              
            player2Won=true;    
            }
             
         }
         
                                //SEE IF BUMP INTO EDGES
         
         //SET BUMP BOOLEANS FOR PLAYER1
         let leftB=checker[0]<leftEdge[2]&&checker[2]>leftEdge[0]&&checker[1]<leftEdge[3]&&checker[3]>leftEdge[1];
         let rightB=checker[0]<rigthEdge[2]&&checker[2]>rigthEdge[0]&&checker[1]<rigthEdge[3]&&checker[3]>rigthEdge[1];
         let topB=checker[0]<topEdge[2]&&checker[2]>topEdge[0]&&checker[1]<topEdge[3]&&checker[3]>topEdge[1];
         let botB=checker[0]<botEdge[2]&&checker[2]>botEdge[0]&&checker[1]<botEdge[3]&&checker[3]>botEdge[1];
         // SEE IF PLAYER1 BUMP
         if(leftB||rightB||topB||botB){
          
          if(lobbies[socket.room].player1.firstBump>10){ //CHECK IF ITS JUST FIRST EDGE OR NOT
            player2Won=true;         
          }
            lobbies[socket.room].player1.firstBump +=1; // IF ITS FIRST EDGE
            

         }else{
          if(lobbies[socket.room].player1.firstBump>0){
          lobbies[socket.room].player1.firstBump=11;
          }
         }
         
         //SET BUMP BOOLEANS FOR PLAYER2
         let leftB1=checker1[0]<leftEdge[2]&&checker1[2]>leftEdge[0]&&checker1[1]<leftEdge[3]&&checker1[3]>leftEdge[1];
         let rightB1=checker1[0]<rigthEdge[2]&&checker1[2]>rigthEdge[0]&&checker1[1]<rigthEdge[3]&&checker1[3]>rigthEdge[1];
         let topB1=checker1[0]<topEdge[2]&&checker1[2]>topEdge[0]&&checker1[1]<topEdge[3]&&checker1[3]>topEdge[1];
         let botB1=checker1[0]<botEdge[2]&&checker1[2]>botEdge[0]&&checker1[1]<botEdge[3]&&checker1[3]>botEdge[1];
         // SEE IF PLAYER2 BUMP
         if(leftB1||rightB1||topB1||botB1){
          
          if(lobbies[socket.room].player2.firstBump>10){ //CHECK IF ITS JUST FIRST EDGE OR NOT
            player1Won=true;
            
          }
            lobbies[socket.room].player2.firstBump +=1; // IF ITS FIRST EDGE
             
         }else{
          if(lobbies[socket.room].player2.firstBump>0){
          lobbies[socket.room].player2.firstBump=11;
          }
         }
         
         if(lobbies[socket.room].round==1){
          lobbies[socket.room].player1.Rwon=0;
          lobbies[socket.room].player2.Rwon=0;
         }
         
         //SEE IF WON OR LOST OR DRAW
         if(player1Won&&player2Won){
            io.sockets.to(socket.room).emit('won',"draw");
            lobbies[socket.room].finished=true;
            
         }else if(player1Won){
            io.sockets.to(socket.room).emit('won',"player1");
            lobbies[socket.room].finished=true;
            lobbies[socket.room].player1.Rwon+=1;
         }else if(player2Won){
            io.sockets.to(socket.room).emit('won',"player2");
            lobbies[socket.room].finished=true;
            lobbies[socket.room].player2.Rwon+=1;
         }

        
         if(lobbies[socket.room].finished){
         
           setTimeout(() => {
          
          lobbies[socket.room].player1.ready=0;
          lobbies[socket.room].player2.ready=0;
          
          if(Math.abs(lobbies[socket.room].player1.Rwon-lobbies[socket.room].player2.Rwon)==2){
            lobbies[socket.room].round+=1;
          }
          
          lobbies[socket.room].round+=1;
               io.sockets.to(socket.room).emit('Rfinished', lobbies[socket.room].round, lobbies[socket.room].player1.Rwon, lobbies[socket.room].player2.Rwon);
               //SEE IF READY OR GIVE DEFAUT SETTINGS
               if (!(lobbies[socket.room].round > 3)) {
                   default_starting_place();
               }
          
           if(lobbies[socket.room].round>3){
          //DELETE ROOM
          delete lobbies[socket.room];
          for( var i = 0; i < rooms.length; i++){ if ( rooms[i] === socket.room) { rooms.splice(i, 1); i--; }}
          socket.leave(socket.room);
          
          }
          
          
          }, 5000);
             
         }
         
        
      }

      function default_starting_place() {

        //IF 10 SECONDS OF WAITING OF CHOOSING IF FINISHED
          setTimeout(() => {
              if (lobbies[socket.room] != null) {

                  if (lobbies[socket.room].player1.ready === 0 || lobbies[socket.room].player2.ready === 0) {
                      if (lobbies[socket.room].player1.ready === 0) {
                          //PLAYER1 WHO CREATED IS READY
                          lobbies[socket.room].player1.ready = 1;

                      }


                      if (lobbies[socket.room].player2.ready === 0) {
                          //PLAYER2 WHO JOINED IS READY
                          lobbies[socket.room].player2.ready = 1;

                      }

                      io.sockets.to(socket.room).emit('readyBack', lobbies[socket.room]);
                      //INTIALIZE COUNTERS AND VARIABLES ARRAYS AND BOOLEANS
                      let variables1 = [];
                      let variables2 = [];

                      lobbies[socket.room].player1.counter = 1;
                      lobbies[socket.room].player1.variables = variables1;
                      lobbies[socket.room].player2.counter = 1;
                      lobbies[socket.room].player2.variables = variables2;
                      lobbies[socket.room].player1.firstBump = 0;
                      lobbies[socket.room].player2.firstBump = 0;
                      lobbies[socket.room].player1.bumpToSelf = 0;
                      lobbies[socket.room].player2.bumpToSelf = 0;
                      lobbies[socket.room].stillTravelling = true;
                      lobbies[socket.room].finished = false;
                      start_position(lobbies[socket.room].player1.x_start * width, lobbies[socket.room].player1.y_start * height, lobbies[socket.room].player2.x_start * width, lobbies[socket.room].player2.y_start * height);
                      playing();

                  }
              }

            }, 10000);
    }
      

});