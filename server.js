const express = require('express');
const path = require('path');
const sql = require('mssql');
require("msnodesqlv8");

const app = express();
const orderRouter = require('./src/routers/orderRouter');
const reportRouter = require('./src/routers/reportRouter');
const poRouter = require('./src/routers/poRouter');
const liRouter = require('./src/routers/liRouter');
const apRouter = require('./src/routers/apRouter');
const itemRouter = require('./src/routers/itemRouter');
const custRouter = require('./src/routers/custRouter');
const batchRouter = require('./src/routers/batchRouter');
const shipRouter = require('./src/routers/shipRouter');

const server = require('http').Server(app);
global.io = require('socket.io')(server);

global.io.on('connection', function (socket) {
	// socket.emit('news', { hello: 'world' });
	// socket.on('my other event', function (data) {
	//   console.log(data);
	// });
});

// CONNECTION
const config = {
	server: "COMPANY-SERVER",
	database: "MailOrderManager",
	driver: 'msnodesqlv8',
	user: process.env.SQL_USER,
	password: process.env.SQL_PASSWORD,
	options: {
		encrypt: false
	}
};
sql.connect(config).catch(err => console.log(err));


// SET LOCAL VIEW VARIABLES
let getData = (req, res, next) => {
	const getSuppliers = new Promise((resolve, reject) => {
		const request = new sql.Request();
		const sqlQuery = `SELECT code, name FROM supplier ORDER BY code`;
		request.query(sqlQuery, (err, recordset) => {
			if(err) {
				console.log(err);
				res.send(err);
				return;
			}
			resolve(recordset.recordset);
		})
	})

	const getUsers = new Promise((resolve, reject) => {
		const request = new sql.Request();
		const sqlQuery = `SELECT code, name FROM momuser ORDER BY code`;
		request.query(sqlQuery, (err, recordset) => {
			if(err) {
				console.log(err);
				res.send(err);
				return;
			}
			resolve(recordset.recordset);
		})
	})

	const clKeys = ['ACCESSORY','AED PROMO','AMAZON','AMZPRIME','AMZVC','AVX','BID','DOD','EBAY','EBAYCPR','EMAIL','EXPO','FAI','FAX','FBA','GRANT','GROUPON','GS','PAYPAL','PHONE','PO','QSALE','TRN','VA','WAL','WEBSALE']
	const orderStatuses = [
		{statcode: 'OR', statdesc: 'On Review'},
		{statcode: 'PI', statdesc: 'Ready to Pick'},
		{statcode: 'BO', statdesc: 'Back Ordered'},
		{statcode: 'IN', statdesc: 'Ready to Pack'},
		{statcode: 'PS', statdesc: 'Packed and Ready to Ship'},
		{statcode: 'BI', statdesc: 'Ready to Invoice'},
		{statcode: 'QO', statdesc: 'Quote'},
		{statcode: 'SH', statdesc: 'Shipped'},
		{statcode: 'PE', statdesc: 'Permanent Hold'},
		{statcode: 'UO', statdesc: 'Uncompleted on Hold'},
		{statcode: 'CD', statdesc: 'Credit Card Declined'},
		{statcode: 'CN', statdesc: 'Canceled'},
		{statcode: 'FH', statdesc: 'Fraud Hold'},
		{statcode: 'IL', statdesc: 'Invalid Package Label'},
	];
	

	Promise.all([getSuppliers, getUsers]).then(([suppliers, users]) => {
		Object.assign(app.locals, {
			suppliers,
			users,
			clKeys,
			orderStatuses
		})

		next();
	}).catch(err => {
		console.log(err);
		res.send(err);
	});
}


// MIDDLEWARE
app.use(getData);
app.use(express.static(path.join(__dirname, '/public/')));
app.set('views', './src/views');
app.set('view engine', 'ejs');

// ROUTES
app.use('/orders', orderRouter);
app.use('/reports', reportRouter);
app.use('/pos', poRouter);
app.use('/li', liRouter);
app.use('/ap', apRouter);
app.use('/items', itemRouter);
app.use('/cust', custRouter);
app.use('/batch', batchRouter);
app.use('/shipping', shipRouter);

// INDEX
app.get('/', (req, res) => {
	res.render('index');
});

// PUSH TO PORT
server.listen(1111, () => {
	console.log('listening on port 1111');
})