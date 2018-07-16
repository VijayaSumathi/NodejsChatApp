var express=require('express');
var router=express();
var http=require('http').Server(router);
var io = require('socket.io')(http);
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var userModel = require('./models/user');
var chatModel = require('./models/chat');
var roomModel = require('./models/room');

var cookieParser = require('cookie-parser');
var session = require('express-session');
var mongoStore = require('connect-mongo')(session);
var methodOverride = require('method-override');
var shortid = require("shortid");
var events = require('events');
var _ = require('lodash');


var eventEmitter = new events.EventEmitter();


//var login = require('./models/login');
//var messages = require('./models/messages');
var path = require('path');
var bodyParser = require('body-parser');
//var url  = require('url');
router.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
router.use(bodyParser.json())

 // render engine
router.set('views', path.join(__dirname, 'views'));
router.set('view engine', 'ejs');

http.listen(3000,function(){
    console.log("Node Server is setup and it is listening on 3000");    
});
//public folder as static
router.use(express.static(path.resolve(__dirname,'./public')));

// db connection


mongoose.connect('mongodb://localhost/dbappchat')
    .then(() => console.log('connected to mongodb\n'))
    .catch((err) => console.log("err"+err) );


    var sessionInit = session({
      name : 'userCookie',
      secret : 'secret}}}[][][]]india',
      resave : true,
      httpOnly : true,
      saveUninitialized: true,
      store : new mongoStore({mongooseConnection : mongoose.connection}),
      cookie : { maxAge : 80*80*800 }
    });

router.use(sessionInit);
    router.all('/user/*', function(req, res, next) {

        if (req.session && req.session.user) {
            return next();
        } else 
        {
            return  res.render('login'); 
        }
    
    });
    
    router.get('/logout',function(req,res){

      delete req.session.user;
      res.render('login');
  
    });
  
router.get('/user/home',function(req,res){
    register.findOne({"name":req.session.user.name},function(err,user){    
     if (!user) {
         // if the user isn't found in the DB, reset the session info and
         // redirect the user to the login page
         req.session.reset();
         return  res.render('login');

     } else {
         console.log("user authentication successful");
         // expose the user to the template
         req.user = user;
         // delete the password from the session
         req.session.user = user; //refresh the session value
         res.locals.user = user;
         // render the approve page
         return res.render('chat');
     }
 });

});



//end session

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('login');
  });

  /* registration */
  router.get('/logout', function(req, res, next) {
    res.redirect('/')
  });

router.get('/registration',function(req,res){
    res.render('registration');
  });

router.post('/register',function(req,res){ 
    var id = shortid.generate();

      console.log(req.body);
      var newUser = new userModel({
        userId : id,
        username : req.body.username,
        email : req.body.email,
        password : req.body.password,
        createdOn : Date.now(),
        updatedOn :  Date.now()
  
      });
      newUser.save(function(err,result){
        if(err){
          console.log(err); 
          res.render('message',
                      {
                        title:"Error",
                        msg:"Some Error Occured During Creation.",
                        status:500,
                        error:err,
                        user:req.session.user,
                        chat:req.session.chat
                      }); 
        }
        else if(result == undefined || result == null || result == ""){
          res.render('message',
                      {
                        title:"Empty",
                        msg:"User Is Not Created. Please Try Again.",
                        status:404,
                        error:"",
                        user:req.session.user,
                        chat:req.session.chat
                      });
        }
        else{
          req.user = result;
          delete req.user.password;
          req.session.user = result;
          delete req.session.user.password;
          res.render('login')
        }

    });


});


router.post('/login',function(req,res){
   
    userModel.findOne({$and:[{'email':req.body.email},{'password':req.body.password}]},function(err,result){
        if(err){
          res.render('message',
                      {
                        title:"Error",
                        msg:"Some Error Occured During Login.",
                        status:500,
                        error:err,
                        user:req.session.user,
                        chat:req.session.chat
                      });
        }
        else if(result == null || result == undefined || result == ""){
          res.render('message',
                      {
                        title:"Error",
                        msg:"User Not Found. Please Check Your Username and Password.",
                        status:404,
                        error:"",
                        user:req.session.user,
                        chat:req.session.chat
                      });
        }
        else{
          req.user = result;
          delete req.user.password;
          req.session.user = result;
           delete req.session.user.password;
              res.render('chat',{
                title:"Chat Home",
                user:req.session.user,
                chat:req.session.chat
              });
        }
      });
    });

    router.get('/chat',function(req,res){

    });
  
   /*               */
  
       //setting chat route
  var ioChat = io.of('/chat');
  var userStack = {};
  var oldChats, sendUserStack, setRoom;
  var userSocket = {};

  //socket.io magic starts here
  ioChat.on('connection', function(socket) {
    console.log("socketio chat connected.");

    //function to get user name
    socket.on('set-user-data', function(username) {
      console.log(username+ "  logged In");



      //storing variable.
      socket.username = username;
      userSocket[socket.username] = socket.id;

      socket.broadcast.emit('broadcast',{ description: username + ' Logged In'});




      //getting all users list
      eventEmitter.emit('get-all-users');

      //sending all users list. and setting if online or offline.
      sendUserStack = function() {
        for (i in userSocket) {
          for (j in userStack) {
            if (j == i) {
              userStack[j] = "Online";
            }
          }
        }
        //for popping connection message.
        ioChat.emit('onlineStack', userStack);
      } //end of sendUserStack function.

    }); //end of set-user-data event.

    //setting room.
    socket.on('set-room', function(room) {
      //leaving room.
      socket.leave(socket.room);
      //getting room data.
      eventEmitter.emit('get-room-data', room);
      //setting room and join.
      setRoom = function(roomId) {
        socket.room = roomId;
        console.log("roomId : " + socket.room);
        socket.join(socket.room);
        ioChat.to(userSocket[socket.username]).emit('set-room', socket.room);
      };

    }); //end of set-room event.

    //emits event to read old-chats-init from database.
    socket.on('old-chats-init', function(data) {
      eventEmitter.emit('read-chat', data);
    });

    //emits event to read old chats from database.
    socket.on('old-chats', function(data) {
      eventEmitter.emit('read-chat', data);
    });

    //sending old chats to client.
    oldChats = function(result, username, room) {
      ioChat.to(userSocket[username]).emit('old-chats', {
        result: result,
        room: room
      });
    }

    //showing msg on typing.
    socket.on('typing', function() {
      socket.to(socket.room).broadcast.emit('typing', socket.username + " : is typing...");
    });

    //for showing chats.
    socket.on('chat-msg', function(data) {
      //emits event to save chat to database.
      eventEmitter.emit('save-chat', {
        msgFrom: socket.username,
        msgTo: data.msgTo,
        msg: data.msg,
        room: socket.room,
        date: data.date
      });
      //emits event to send chat msg to all clients.
      ioChat.to(socket.room).emit('chat-msg', {
        msgFrom: socket.username,
        msg: data.msg,
        date: data.date
      });
    });

    //for popping disconnection message.
    socket.on('disconnect', function() {

      console.log(socket.username+ "  logged out");
      socket.broadcast.emit('broadcast',{ description: socket.username + ' Logged out'});



      console.log("chat disconnected.");

      _.unset(userSocket, socket.username);
      userStack[socket.username] = "Offline";

      ioChat.emit('onlineStack', userStack);
    }); //end of disconnect event.

  }); //end of io.on(connection).
  //end of socket.io code for chat feature.

  //database operations are kept outside of socket.io code.
  //saving chats to database.
  eventEmitter.on('save-chat', function(data) {

    // var today = Date.now();

    var newChat = new chatModel({

      msgFrom: data.msgFrom,
      msgTo: data.msgTo,
      msg: data.msg,
      room: data.room,
      createdOn: data.date

    });

    newChat.save(function(err, result) {
      if (err) {
        console.log("Error : " + err);
      } else if (result == undefined || result == null || result == "") {
        console.log("Chat Is Not Saved.");
      } else {
        console.log("Chat Saved.");
        //console.log(result);
      }
    });

  }); //end of saving chat.

  //reading chat from database.
  eventEmitter.on('read-chat', function(data) {

    chatModel.find({})
      .where('room').equals(data.room)
      .sort('-createdOn')
      .skip(data.msgCount)
      .lean()
      .limit(5)
      .exec(function(err, result) {
        if (err) {
          console.log("Error : " + err);
        } else {
          //calling function which emits event to client to show chats.
          oldChats(result, data.username, data.room);
        }
      });
  }); //end of reading chat from database.

  //listening for get-all-users event. creating list of all users.
  eventEmitter.on('get-all-users', function() {
    userModel.find({})
      .select('username')
      .exec(function(err, result) {
        if (err) {
          console.log("Error : " + err);
        } else {
          //console.log(result);
          for (var i = 0; i < result.length; i++) {
            userStack[result[i].username] = "Offline";
          }
          //console.log("stack "+Object.keys(userStack));
          sendUserStack();
        }
      });
  }); //end of get-all-users event.

  //listening get-room-data event.
  eventEmitter.on('get-room-data', function(room) {
    roomModel.find({
      $or: [{
        name1: room.name1
      }, {
        name1: room.name2
      }, {
        name2: room.name1
      }, {
        name2: room.name2
      }]
    }, function(err, result) {
      if (err) {
        console.log("Error : " + err);
      } else {
        if (result == "" || result == undefined || result == null) {

          var today = Date.now();

          newRoom = new roomModel({
            name1: room.name1,
            name2: room.name2,
            lastActive: today,
            createdOn: today
          });

          newRoom.save(function(err, newResult) {

            if (err) {
              console.log("Error : " + err);
            } else if (newResult == "" || newResult == undefined || newResult == null) {
              console.log("Some Error Occured During Room Creation.");
            } else {
              setRoom(newResult._id); //calling setRoom function.
            }
          }); //end of saving room.

        } else {
          var jresult = JSON.parse(JSON.stringify(result));
          setRoom(jresult[0]._id); //calling setRoom function.
        }
      } //end of else.
    }); //end of find room.
  }); //end of get-room-data listener.
  //end of database operations for chat feature.

  //

   /*                */


module.exports = router;
