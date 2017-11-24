var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session')

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/reefctl');

var routes = require('./routes/index');
var users = require('./routes/users');
var test = require('./routes/test')
var dashboard = require('./routes/dashboard')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
var dust = require('dustjs-linkedin')
var cons = require('consolidate')
app.engine('dust', cons.dust);
app.set('view engine', 'dust');

var utils = require("./utils");
utils.init_dust_helpers( dust );
utils.load_instr_mods();

//var urls = [];
//urls['fixture'] = '10.10.2.4:1000';

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(__dirname + '/public/javascripts')); 
app.use('/css', express.static(__dirname + '/public/stylesheets')); 

// bootstrap and jquery links
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js')); // redirect bootstrap JS
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist')); // redirect JS jQuery
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // redirect CSS bootstrap
app.use('/js', express.static(__dirname + '/node_modules/bootstrap-checkbox/dist/js')); // redirect bootstrap JS


// Filter to define session.
app.use(session({
	secret: 'steves reef',
    resave: false,
	saveUninitialized: true
}))

// Filter to add app-level objects to the request.
app.use(function(req,res,next){
    req.db = db;
	req.dust = dust;
	req.utils = utils;
	//req.urls = urls;

	//var session = {};
	//req.session = session;
	utils.init_session(req);

    next();
});

app.use('/', routes);
app.use('/users', users);
app.use('/test', test);
app.use('/', dashboard.router);

utils.setup_instr_routes( app );

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

console.log("Ready");

module.exports = app;
