var fs = require('fs');

var DataAcceptor = function(pv) {
    this.pv = pv;
};

function copyWithoutKey(ind, banned) {
    var od = {};
    var keys = Object.keys(ind);
    for (var i=0; i<keys.length; i++) {
        var key = keys[i];
        if (key != banned) od[key] = ind[key];
    }
    return od;
}


DataAcceptor.prototype.handleProvision = function(req, res) {
    var arg = {
        name: req.params.name.replace('/',''),
        serial_number: req.body.serial_number || '',
        provtok: req.body.provtok || '',
    };
    var rv = this.pv.provision(arg);
    if (rv) {
        this.getcstate(rv.sensor_name);
        res.status('200');
        var sv = copyWithoutKey(rv, 'serial_number');
        res.json(sv);
        return;
    }
    res.status('403');
    res.json({message: 'begone!'});
};


DataAcceptor.prototype.setSensorParams = function(cps) {
    this.cparams = cps;
};


DataAcceptor.prototype.getcstate = function(name) {
    var cs = this.cstates[name] || null;
    if (!cs) {
        cs = {
            sensor_name: name,
            busy: false,
            valid: false,
            image_number: 0,
        };
        this.cstates[name] = cs;
    }
    return cs;
};

DataAcceptor.prototype.setupDefaults = function() {
    console.log('setupDefaults()');
    var cstates = {};
    this.cstates = cstates;
    var othis = this;
    Object.keys(this.pv.getProvisioned()).forEach(function(sensor_name) {
        othis.getcstate(sensor_name);
    });
};


DataAcceptor.prototype.handleParamsGet = function(req, res) {
    var b = { sensor_name: req.params.name, token: req.query.token };
    if (this.pv.tokValid(b)) {
        res.status(200);
        if (this.cparams.hasOwnProperty(b.sensor_name)) {
            res.json(this.cparams[b.sensor_name]);
        } else {
            res.json({});
        }
        return;
    }
    res.status(403);
    res.json({ message: 'nyet.' }); 
};


DataAcceptor.prototype.handleStillHere = function(req, res) {
    console.log('ping!');
    var iaobj = this;
    var b = req.body;
    if (this.pv.tokValid(b)) {
       var sensor_name= b.sensor_name;
       var cstate = this.getcstate(sensor_name);
       cstate.ping = {
           'date': b.date,
           'source_ip': b.source_ip,
       };
       res.status(200);
       res.json({message: 'thanks!' });
       return;
    }
    res.status(403);
    res.json({ message: 'nope.' });
};


DataAcceptor.prototype.handleDataPost = function(req, res) {
    console.log('handleDataPost()');
    var iaobj = this;
    var b = req.body;
    // console.log(JSON.stringify(b,null,2));
    if (this.pv.tokValid(b)) {
       var sensor_name= b.sensor_name;
       var cstate = this.getcstate(sensor_name);
       if (!cstate) {
           res.status('403');
           res.json({message:'unknown device'});
           return;
       }
       cstate.busy = true;
       cstate.source_ip = b.source_ip; 
       cstate.date = b.date;
       cstate.sensor_data = b.sensor_data;
       cstate.valid = true;
       cstate.upload_number += 1;
       cstate.busy = false;
       res.status(200);
       res.json({message: 'thanks!', upload_number: cstate.upload_number});
    } else {
       res.status(403);
       res.json({ message: 'nope.' });
    }
};


DataAcceptor.prototype.handleListGet = function(req, res) {
    console.log('GET list of sensors');
    var cstates = this.cstates;
    rv = Object.keys(cstates);
    res.json(rv);
};


DataAcceptor.prototype.handleStatusGet = function(req, res) {
    console.log('GET sensor status!');
    var name = req.params.name;
    var cstate = this.cstates[name] || null;
    rv = {};
    if (cstate) {
        Object.keys(cstate).forEach(function(k) {
            if (k !== 'image_jpeg') rv[k] = cstate[k];
        });
    } else {
        rv.message = 'no such sensor';
    }
    res.json(rv);
};


module.exports = DataAcceptor;
