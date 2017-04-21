console.log("AngularJS BSEM Added");

const path = require("path"),
    fs = require("fs")
;
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

exports.before = (mod, ...args) => {
    mod.settings = {};
};

exports.lex = {
    called: {
        length: 1,
        handler: (mod, ...args) => {
            mod.settings.name = args[0];
        }
    },
    path: {
        length: 1,
        handler: (mod, ...args) => {
            mod.settings.path = args[0];
        }
    },
    from: {
        length: 1,
        handler: (mod, ...args) => {
            mod.settings.source = args[0];
        }
    },
    generate: {
        length: 1,
        handler: (mod, arg) => {
            switch (arg) {
                case "service":
                    if (mod.settings.source) {
                        generateService(mod);
                    } else {
                        console.log("No source specified");
                    }
                    break;
                case "service/http":
                    generateHttpService(mod);
                    break;
                case "service/scope":
                    generateScopeService(mod);
                    break;
                case "map":
                    prepareMap(mod);
                    break;
                case "app":
                    generateApp(mod);
                    break;
                case "controller":
                    prepareController(mod);
                    break;
            }
        }
    },
    install: {
        length: 0,
        handler: (mod) => {
            console.log("Installing angularjs");
            execute("npm install --save angular@1.6.3")
                .then(data => {
                    console.log("All done.");
                })
                .catch(console.log)
            ;
        }
    }
};

exports.after = (mod, ...args) => {

};


//Create Void infrastructure
function mdir(path) {
    try {
        fs.mkdirSync(path);
    } catch (e) {
        //console.log(e);
    }
}

function execute(command) {
    return new Promise(function (resolve, reject) {
        var pro = require('child_process').exec(command, function (error, stdout, stderr) {
            resolve({
                error,
                stdout,
                stderr
            })
        });
    });
}

function writeToFile(filename, contents) {
    return new Promise(function (resolve, reject) {
        fs.writeFile(filename, contents, function (errors) {
            if (errors) {
                reject(errors);
            } else {
                resolve();
            }
        });
    });
}

function readFile(path) {
    return new Promise(function (resolve, reject) {
        fs.readFile(path, 'utf8', function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function generateScopeService(mod) {
    writeToFile(path.join(process.cwd(), "front/javascript/rScope.gen.service.js"), `class RadixScope {

    constructor() {

    }

    safeApply($scope, fn) {
        var phase = $scope.$root.$$phase;
        if (phase === '$apply' || phase === '$digest') {
            if (fn && typeof fn === 'function') {
                fn();
            }
        } else {
            $scope.$apply(fn);
        }
    }
}`).then(_ => console.log("rScope.gen.service.js was generated. \nRemember to include polyfills for the es6 class or adapt this file"));
}

function generateHttpService(mod) {
    writeToFile(path.join(process.cwd(), "front/javascript/rHttp.gen.service.js"), `class RadixHttp {

    constructor(http){
        this.http = http;
    }

    request(httpParam){
        var self = this;
        return new Promise(function(resolve, reject){
            self.http(httpParam).then(resolve, reject);
        })
    }

    objectToUrlString(data) {
        let myString = "";
        for(var dataBit in data){
            if(myString.length){
                myString += "&";
            }
            myString += dataBit.toString() + "=" + JSON.stringify(data[dataBit]);
        }
        return myString;
    }
}`).then(_ => console.log("rHttp.gen.service.js was generated. \nRemember to include polyfills for the es6 class or adapt this file"));
}

function generateMap(mod){
    if(!mod.settings.name) {
        throw "No name specified";
    }
    writeToFile(path.join(process.cwd(), `front/javascript/${mod.settings.name}.gen.map.json`), `{
    "name": "${mod.settings.name}",
    "services": {
    
    },
    "controllers": {
    
    }
}`).then(_ => console.log(`${mod.settings.name}.gen.map.json was generated.`));
}




function generateService(mod) {

    const mongoose = require('mongoose');
    const Schema = mongoose.Schema;

    let basePath = "./schemas/";
    let schema;
    try {
        schema = require(path.join(process.cwd(), basePath, mod.settings.source));
    } catch (all) {
        console.log(all);
        console.log("A problem occured oppening " + path.join("[PSD]/schemas/", mod.settings.source));
    }
    let validators = {};
    let object = [];
    let identifiers = ["id"];
    if (!schema.$$name) {
        console.log("Error no name for schema");
        return -1;
    }
    for (let i in schema) {
        if (i.substr(0, 2) === "$$") continue;
        object.push(i.toString());
        if (typeof schema[i].validator === 'function') {
            validators[i] = schema[i].validator;
        }
        if (schema[i].identifier) {
            identifiers.push(i.toString());
        }
    }
    // console.log(object);
    // console.log(validators);
    // console.log(identifiers);
    let content = `function ${schema.$$name}Factory(rHttp) {
    var baseRoute = "/${schema.$$name}";
    
    function ${capitalizeFirstLetter(schema.$$name)}(data) {
        if (!data) {
            data = {};
        }
        this._id = data._id;    
`;
    object.forEach(prop => content += `        this.${prop} = data.${prop};\n`);
    let className = capitalizeFirstLetter(schema.$$name);
    content += `
        this.update = function () {
            return rHttp.request({
                url: baseRoute + '/byId/' + this._id,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                method: 'PUT',
                data: rHttp.objectToUrlString(this.toLiteral())
            });
        };

        this.delete = function () {
            return rHttp.request({
                url: baseRoute + '/byId/' + this._id,
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                method: 'DELETE',
                data: ''
            });
        };

        this.fetch = function(){
            var self = this;
            if(this._id){
                return rHttp.request({
                    url: baseRoute + '/byId/' + this._id,
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    method: 'GET',
                    data: ''
                }).then(function(response){
                    self._id = response.data._id;
                    self.firstName = response.data.firstName;
                    self.lastName = response.data.lastName;
                    self.role = response.data.role;
                });
            } else {
                return Promise.reject("No id to use as reference");
            }
        };

        this.push = function () {
            return rHttp.request({
                url: baseRoute + '/',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                method: 'POST',
                data: rHttp.objectToUrlString(this.toLiteral())
            });
        };

        this.toLiteral = function () {
            return {
${(() => object.map(e => `                ${e}: this.${e}`).join(",\n"))()}
            }
        }
    }
    
    
    ${className}.getByPage = function(page){
        return rHttp.request({
            url: baseRoute + '/byPage/' + page,
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            method: 'GET',
            data: ''
        });
    };

    ${className}.create = function(data){
        return rHttp.request({
            url: baseRoute + '/',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            method: 'POST',
            data: rHttp.objectToUrlString(data)
        }).then(function(response){
            return new ${className}(response.data);
        });
    };
    
${(() => identifiers.map(e => {
        let E = capitalizeFirstLetter(e);
        let byE = "by" + E;
        return `
    ${className}.${byE} = function (${e}) {
        return {
            get: function(){
                return rHttp.request({
                    url: baseRoute + '/${byE}/' + ${e},
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    method: 'GET',
                    data: ''
                }).then(function(response){
                    return response.data;
                });
            },
            update: function(data){
                return rHttp.request({
                    url: baseRoute + '/${byE}/' + ${e},
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    method: 'PUT',
                    data: rHttp.objectToUrlString(data)
                }).then(function(response){
                    return response.data;
                });
            },
            delete: function(){
                return rHttp.request({
                    url: baseRoute + '/${byE}/' + ${e},
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                    method: 'DELETE',
                    data: ''
                });
            }
        }
    };
`;
    }).join("\n"))()}
    
    ${className}.validators = {
${(() => Object.keys(validators).map(e => `        ${e}: ${validators[e].toString()}`).join(",\n"))()}
    };
    
    return ${className};
}`;
    writeToFile(path.join(process.cwd(), "front/javascript/" + schema.$$name + ".gen.service.js"), content)
        .then(data => {
            console.log("File: " + path.join(process.cwd(), "front/javascript/" + schema.$$name + ".gen.service.js"));
            console.log("Angular service was generated.");
            console.log("Remember to change baseRoute depending on how you registered the model");
        })
        .catch(error => {
            console.log(error);
        })
    ;
}


function generateController(mod){
    if(!mod.settings.source){
        throw "No source specified please specify using key word 'from'";
    }
    if(!mod.settings.name){
        throw "No name specified please specify using key word 'called'";
    }
    console.log(require("front/javascript/"+mod.settings.source).controllers);
}
function generateApp(mod) {

}
exports.tasks = {};

exports.build = [];
exports.watch = [];
exports.serve = [];