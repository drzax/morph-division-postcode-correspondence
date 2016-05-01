// This is a template for a Node.js scraper on morph.io (https://morph.io)
var fs = require('fs');
var path = require('path');
var cheerio = require("cheerio");
var request = require("request");
var sqlite3 = require("sqlite3").verbose();
var queue = require('queue-async');
var clone = require('clone');

var db;
var q;
var fetched = [];

const BASE = 'http://apps.aec.gov.au/eSearch/';
const LISTING = BASE + 'LocalitySearchResults.aspx';

// Delete existing data
try {
	fs.unlinkSync(path.join(__dirname, 'data.sqlite'));
} catch(e) {}

q = queue(10);

get(LISTING).then(processListing, handleErr);

db = new Promise((resolve, reject) => {
		var conn = new sqlite3.Database("data.sqlite");
		conn.serialize(() => {
			conn.run(`CREATE TABLE IF NOT EXISTS data
					 (state TEXT,
						suburb TEXT,
						postcode TEXT,
						electorate TEXT,
						redistributedElectorate TEXT,
						otherLocalities TEXT)`, (err) => err ? reject(err) : resolve(conn));
		});
	});

function processListing($){
	getPagingLinks($).forEach((l) => {
		if (fetched.indexOf(l.url + l.form.__EVENTTARGET + l.form.__EVENTARGUMENT) === -1)
			post(l.url, l.form).then(processListing).catch(handleErr);
	});


	$('#ContentPlaceHolderBody_gridViewElectorates > tr')
		.not('.pagingLink')
		.not('.headingLink')
		.each(function() {
			get(BASE + $(this).find('a').attr('href'))
				.then(processDetailPage);
		});
}

function processDetailPage($) {

	getPagingLinks($).forEach((l) => {
		if (fetched.indexOf(l.url + l.form.__EVENTTARGET + l.form.__EVENTARGUMENT) === -1)
			post(l.url, l.form).then(processDetailPage).catch(handleErr);
	});

	$('#ContentPlaceHolderBody_gridViewLocalities > tr')
		.not('.pagingLink')
		.not('.headingLink')
		.each(function() {
			var data = [];

			$(this).find('td').each(function(){
				data.push($(this).text().trim());
			});

			db.then(function(db) {
				console.log(data);
				db.run("INSERT INTO data VALUES (?, ?, ?, ?, ?, ?)", data, (global.gc) ? global.gc : null);
			}, handleErr);
		});
}

function getPagingLinks($) {

	var links = [], state = {};

	$('input').filter((i, el) => {
		return $(el).attr('name').substr(0,2) === '__';
	}).each((i, el) => {
		state[el.attribs.name] = el.attribs.value;
	});

	// Look for paging links
	$('table .pagingLink').find('a').each(function(){
		var matches = $(this).attr('href').match(/'([^']+)'[^']+'([^']+)/);
		var cloneState = clone(state);
		cloneState.__EVENTTARGET = matches[1];
		cloneState.__EVENTARGUMENT = matches[2];
		links.push({
			url: BASE+$('#formMaster').attr('action'),
			form: cloneState
		});
	});

	return links;

}

function post(url, data) {

	fetched.push(url + data.__EVENTTARGET + data.__EVENTARGUMENT);

	var req = {
		url: url,
		form: data,
		headers: {
			"Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			"Content-Type":"application/x-www-form-urlencoded",
			"DNT":"1",
			"Host":"apps.aec.gov.au",
			"Origin":"http://apps.aec.gov.au",
			"Pragma":"no-cache",
			"Referer":"http://apps.aec.gov.au/eSearch/LocalitySearchResults.aspx",
			"Upgrade-Insecure-Requests":"1",
			"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36"
		}
	};

	return (new Promise((resolve, reject) => {
		q.defer((cb) => {
			request.post(req, (err, req, body) => {
				if (err) reject(err);
				else resolve(body);
				cb();
				if (global.gc) global.gc();
			});
		});
	})).then(cheerio.load, handleErr);
}

function get(url) {
	// Use request to read in pages.
	return (new Promise((resolve, reject) => {
		q.defer((cb) => {
			request(url, (err, res, body) => {
				if (err) reject(err);
				resolve(body);
				cb();
				if (global.gc) global.gc();
			});
		});
	})).then(cheerio.load, handleErr);
}

function handleErr(err) {
	console.log(err);
	process.exit(1);
}
