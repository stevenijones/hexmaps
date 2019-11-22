function ResultsMap(id,attr){
	if(!attr) attr = {};
	if(!attr.padding) attr.padding = 0;
	if(!attr.width || !attr.height || !attr.file || !attr.views) return {};

	this.w = attr.width;
	this.h = attr.height;
	this.aspectratio = attr.width/attr.height;
	this.id = id;
	this.type = "";
	this.files = {};
	this.views = attr.views;

	if(S('#data-selector').length > 0) this.type = S('#data-selector')[0].value;
	if(S('.view-toggle').length > 0) this.type = document.querySelector('input[name="view"]:checked').id;

	this.defaulttype = this.type;

	// Use the search string to pick a parameter to display
	var t = location.search.replace(/\?/,"");
	if(t){
		// Check if this is in the list
		var options = S('#data-selector option');
		if(options.length > 0){
			var ok = false;
			var v = "";
			for(var i = 0; i < options.length; i++){
				if(options[i].getAttribute('value')==t){
					ok = true;
				}
			}
			if(ok){
				S('#data-selector')[0].value = t;
				this.type = t;
			}
		}else{
			// Check if this is in the list
			var options = S('.view-toggle');

			if(options.length > 0){
				var v = "";
				for(var i = 0; i < options.length; i++){
					if(options[i].getAttribute('id')==t){
						options[i].checked = true;
						this.type = t;
					}
				}
			}
		}
	}


	// Create a hex map
	attrhex = JSON.parse(JSON.stringify(attr));
	attrhex.id = id;
	attrhex.size = 16;

	this.hex = new HexMap(attrhex);

	// Do we update the address bar?
	this.pushstate = !!(window.history && history.pushState);

	// Add "back" button functionality
	var _obj = this;
	if(this.pushstate){
		window[(this.pushstate) ? 'onpopstate' : 'onhashchange'] = function(e){
			if(e.state && e.state.type) _obj.updateData(e.state.type);
			else _obj.updateData(_obj.defaulttype)
		};
	}

	this.hex.load(attr.file,{me:this},function(e){
		e.data.me.setType(e.data.me.type,(e.data.me.type!=e.data.me.defaulttype ? true : false));
	});
	
	this.setType = function(t,update){

		// Have we changed type?
		if(t==this.by){
			console.log('no change');
			return this;
		}

		// Update the history
		if(this.pushstate) history.pushState({type:t},"Hexes",(update ? '?'+t : ''));

		this.updateData(t);

		return this;
	}

	this.startPolling = function(type){
		// Poll this data on an interval
		if(this.views[type].live){
			console.info('Start loop for '+type)
			_obj = this;
			this.polling = window.setInterval(function(){
				_obj.loadResults(type,function(type){
					// Set the colours of the map
					this.setColours(attr.type);
				});
			},60000);
		}else{
			if(this.polling){
				console.info('Stop loop');
				clearInterval(this.polling);
			}
		}
	}

	this.updateData = function(type){

		if(this.polling){
			console.info('Stop loop');
			clearInterval(this.polling);
		}

		if(!this.data || !this.data[type]){
			return this.loadResults(type,function(type){
				// Set the colours of the map
				this.setColours(type);
				// Start polling for updates
				if(this.views[type].live) this.startPolling(type);
			});
		}

		// Set the colours
		this.setColours(type);
		
		// Start polling for updates
		if(this.views[type].live) this.startPolling(type);
		
		return this;
	}

	// Add events to map
	this.hex.on('mouseover',function(e){

		e.data.hexmap.regionFocus(e.data.region);

	}).on('mouseout',{'builder':this},function(e){

		e.data.hexmap.regionBlur(e.data.region);

	}).on('click',{'builder':this},function(e){

		e.data.builder.toggleActive(e.data.region);

	});
	
	this.toggleActive = function(region){
		
		var previous = this.hex.selected;
		var current = region;
		if(this.hex.search.active) this.hex.search.toggle();
		if(previous && current == previous) this.hex.regionToggleSelected(previous,true);
		else this.hex.selectRegion(region);
		if(!this.hex.selected) S('.infobubble').remove();
		else this.label(region);
		return this;
	}

	this.label = function(region){
		var view = this.views[this.by];
		if(!view) return this;
		var popup = view.popup;
		var title = this.hex.hexes[region].el[0].getAttribute('title');

		function callback(title,region,data){
			var lbl = this.hex.mapping.hexes[region].label;
			var l = {};
			if(popup && typeof popup.render==="function"){
				l = popup.render.call(this,title,region,data);
			}else{
				console.warning('No view for '+this.by);
				l = {'label':title,'class':cls};
			}
			var c = l.color;
			var t = (l.color ? setTextColor(c) : '');
			var txt = l.label;
			if(S('.infobubble').length == 0) S('#'+this.id+'').after('<div class="infobubble"><button class="close button" title="Close constituency information">&times;</button><div class="infobubble_inner"></div></div>');
			S('.infobubble_inner').html(txt).css({'width':(l.w ? l.w+'px':''),'height':(l.h ? l.h+'px':'')});
			S('.infobubble').attr('class','infobubble'+(l['class'] ? ' '+l['class'] : ''));
			S('.infobubble .close').on('click',{me:this},function(e){ e.data.me.toggleActive(); });
			if(c) S('.infobubble').css({'background-color':c,'color':setTextColor(c)});
			return this;
		}
		// May need to load data first
		if(popup.file){
			// Load data from a file
			S().ajax(popup.file.replace(/%region%/g,region),{
				'this': this,
				'callback': callback,
				'dataType':(popup.file.indexOf(".json") > 0 ? 'json':'text'),
				'region': region,
				'cache': (typeof popup.live==="boolean" ? !popup.live : true),
				'render': popup.render,
				'title': title,
				'success': function(d,attr){
					// Convert to JSON if CSV
					if(attr.dataType=="text") d = CSV2JSON(d);
					// Render the data
					attr.render.call(this,attr.title,attr.region,d);
					if(typeof attr.callback==="function") attr.callback.call(this,attr.title,attr.region,d);
				},
				'error': function(e,attr){
					console.error('Unable to load '+attr.url);
					if(typeof attr.callback==="function") attr.callback.call(this,attr.title,attr.region);
				}
			});
		}else{
			callback.call(this,title,region);
		}

		return this;
	}

	// Add events to buttons for colour changing
	S('.view-toggle').on('change',{me:this},function(e){
		e.data.me.setType(document.querySelector('input[name="view"]:checked').id,true);
	});


	// Make save functions
	if(typeof Blob==="function"){
		// Add event to button
		S('#save').on('click',{me:this},function(e){ e.data.me.save(); });
		// Add key binding
		S(document).on('keypress',function(e){
			if(e.originalEvent.charCode==109) S('#savesvg').trigger('click');     // M
			if(e.originalEvent.charCode==104) S('#save').trigger('click');     // H
		});

		// Add event to button
		S('#savesvg').on('click',{me:this},function(e){ e.data.me.saveSVG(); });

	}else{
		S('#save').css({'display':'none'});
		S('#savesvg').css({'display':'none'});
	}

	this.saveSVG = function(){

		// Make hex json
		var str = this.hex.paper.canvas.html();
		this.save(str,"map.svg",'text/application/svg+xml');

		return this;
	}

	this.save = function(str,file,type){

		// Make hex json

		if(!str) str = JSON.stringify(this.hex.mapping).replace(/\}\,/g,"},\n\t\t").replace(/\}\}\}/,"}\n\t\}\n\}").replace(/\"hexes\":{/,"\n\t\"hexes\": {\n\t\t").replace(/{"layout"/,"{\n\t\"layout\"");
		if(!file) file = "test.hexjson";
		if(!type) type = 'text/application/json';

		var textFileAsBlob = new Blob([str], {type:type});
		var fileNameToSaveAs = file;
	
		function destroyClickedElement(event){ document.body.removeChild(event.target); }
		var dl = document.createElement("a");
		dl.download = fileNameToSaveAs;
		dl.innerHTML = "Download File";
		if(window.webkitURL != null){
			// Chrome allows the link to be clicked
			// without actually adding it to the DOM.
			dl.href = window.webkitURL.createObjectURL(textFileAsBlob);
		}else{
			// Firefox requires the link to be added to the DOM
			// before it can be clicked.
			dl.href = window.URL.createObjectURL(textFileAsBlob);
			dl.onclick = destroyClickedElement;
			dl.style.display = "none";
			document.body.appendChild(dl);
		}
		dl.click();
		return this;
	}

	this.loadResults = function(type,callback){
		if(!type) type = "GE2015-results";

		if(!this.data) this.data = {};
		this.data[type] = {};
		if(!this.hex.data) this.hex.data = {};
		this.hex.data[type] = {};

		if(this.views[type]){
			console.info('Getting '+this.views[type].file);
			S().ajax(this.views[type].file,{
				'this': this,
				'callback': callback,
				'dataType':(this.views[type].file.indexOf(".json") > 0 ? 'json':'text'),
				'type': type,
				'cache': (typeof this.views[type].live==="boolean" ? !this.views[type].live : true),
				'process': this.views[type].process,
				'success': function(d,attr){
					// Convert to JSON if CSV
					if(attr.dataType=="text") d = CSV2JSON(d);
					// Process the data
					attr.process.call(this,attr.type,d);
					if(typeof attr.callback==="function") attr.callback.call(this,attr.type);
				},
				'error': function(e,attr){
					console.error('Unable to load '+attr.url);
				}
			});
			
		}
		return this;
	}

	this.setColours = function(type){
		if(!type) type = "region";
		
		if(S('#data-selector').length > 0) S('#data-selector')[0].value = type;
		if(S('.view-toggle').length > 0){
			var options = S('.view-toggle');
			for(var i = 0; i < options.length; i++){
				if(options[i].getAttribute('id')==type) options[i].checked = true;
			}
		}

		this.by = type;

		var key = "";

		// Set the function for changing the colours and creating the key
		if(this.views[type] && typeof this.views[type].key==="function") key = this.views[type].key.call(this);
		
		// Update the key
		S('#key').html(key);

		// Update the map colours
		this.hex.updateColours();
		
		// Re-render the popup?
		if(this.hex.selected) this.label(this.hex.selected); //re-render

		return this;
	}


	function CSV2JSON(data,format,start,end){

		if(typeof start!=="number") start = 1;
		var delim = ",";

		var lines = CSVToArray(data);
		if(typeof end!=="number") end = lines.length;

		var header = lines[0];
		var simpleheader = JSON.parse(JSON.stringify(header));
		var line,datum,key,key2,f,i;
		var newdata = new Array();
		var lookup = {};
		// Work out a simplified (no spaces, all lowercase) version of the 
		// keys for matching against column headings.
		if(format){
			for(i in format){
				key = i.replace(/ /g,"").toLowerCase();
				lookup[key] = i+'';
			}
			for(i = 0; i < simpleheader.length; i++) simpleheader[i] = simpleheader[i].replace(/ /g,"").toLowerCase();
		}
		for(i = start; i < end; i++){
			line = lines[i];
			datum = {};
			if(line){
				for(var j=0; j < line.length; j++){
					key = header[j];
					key2 = simpleheader[j];
					if(format && lookup[key2]){
						key = lookup[key2];
						f = format[key];
						if(format[key].name) key = format[key].name;
						if(f.format=="number"){
							if(line[j]!=""){
								if(line[j]=="infinity" || line[j]=="Inf") datum[key] = Number.POSITIVE_INFINITY;
								else datum[key] = parseFloat(line[j]);
							}
						}else if(f.format=="eval"){
							if(line[j]!="") datum[key] = eval(line[j]);
						}else if(f.format=="date"){
							if(line[j]){
								line[j] = line[j].replace(/^"/,"").replace(/"$/,"");
								try {
									datum[key] = new Date(line[j]);
								}catch(err){
									this.log.warning('Invalid date '+line[j]);
									datum[key] = new Date('0001-01-01');
								}
							}else datum[key] = null;
						}else if(f.format=="boolean"){
							if(line[j]=="1" || line[j]=="true" || line[j]=="Y") datum[key] = true;
							else if(line[j]=="0" || line[j]=="false" || line[j]=="N") datum[key] = false;
							else datum[key] = null;
						}else{
							datum[key] = (line[j][0]=='"' && line[j][line[j].length-1]=='"') ? line[j].substring(1,line[j].length-1) : line[j];
						}
					}else{
						datum[key] = (line[j][0]=='"' && line[j][line[j].length-1]=='"') ? line[j].substring(1,line[j].length-1) : line[j];
					}
				}
				newdata.push(datum);
			}
		}
		return newdata;
	}
	
	/**
	 * CSVToArray parses any String of Data including '\r' '\n' characters,
	 * and returns an array with the rows of data.
	 * @param {String} CSV_string - the CSV string you need to parse
	 * @param {String} delimiter - the delimeter used to separate fields of data
	 * @returns {Array} rows - rows of CSV where first row are column headers
	 */
	function CSVToArray (CSV_string, delimiter) {
	   delimiter = (delimiter || ","); // user-supplied delimeter or default comma

	   var pattern = new RegExp( // regular expression to parse the CSV values.
		 ( // Delimiters:
		   "(\\" + delimiter + "|\\r?\\n|\\r|^)" +
		   // Quoted fields.
		   "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
		   // Standard fields.
		   "([^\"\\" + delimiter + "\\r\\n]*))"
		 ), "gi"
	   );

	   var rows = [[]];  // array to hold our data. First row is column headers.
	   // array to hold our individual pattern matching groups:
	   var matches = false; // false if we don't find any matches
	   // Loop until we no longer find a regular expression match
	   while (matches = pattern.exec( CSV_string )) {
		   var matched_delimiter = matches[1]; // Get the matched delimiter
		   // Check if the delimiter has a length (and is not the start of string)
		   // and if it matches field delimiter. If not, it is a row delimiter.
		   if (matched_delimiter.length && matched_delimiter !== delimiter) {
			 // Since this is a new row of data, add an empty row to the array.
			 rows.push( [] );
		   }
		   var matched_value;
		   // Once we have eliminated the delimiter, check to see
		   // what kind of value was captured (quoted or unquoted):
		   if (matches[2]) { // found quoted value. unescape any double quotes.
			matched_value = matches[2].replace(
			  new RegExp( "\"\"", "g" ), "\""
			);
		   } else { // found a non-quoted value
			 matched_value = matches[3];
		   }
		   // Now that we have our value string, let's add
		   // it to the data array.
		   rows[rows.length - 1].push(matched_value);
	   }
	   return rows; // Return the parsed data Array
	}


	// Start of colour code

	function d2h(d) { return ((d < 16) ? "0" : "")+d.toString(16);}
	function h2d(h) {return parseInt(h,16);}

	// Define colour routines
	function Colour(c,n){
		if(!c) return {};

		/**
		 * Converts an RGB color value to HSV. Conversion formula
		 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
		 * Assumes r, g, and b are contained in the set [0, 255] and
		 * returns h, s, and v in the set [0, 1].
		 *
		 * @param   Number  r       The red color value
		 * @param   Number  g       The green color value
		 * @param   Number  b       The blue color value
		 * @return  Array           The HSV representation
		 */
		function rgb2hsv(r, g, b){
			r = r/255, g = g/255, b = b/255;
			var max = Math.max(r, g, b), min = Math.min(r, g, b);
			var h, s, v = max;
			var d = max - min;
			s = max == 0 ? 0 : d / max;
			if(max == min) h = 0; // achromatic
			else{
				switch(max){
					case r: h = (g - b) / d + (g < b ? 6 : 0); break;
					case g: h = (b - r) / d + 2; break;
					case b: h = (r - g) / d + 4; break;
				}
				h /= 6;
			}
			return [h, s, v];
		}

		this.alpha = 1;

		// Let's deal with a variety of input
		if(c.indexOf('#')==0){
			this.hex = c;
			this.rgb = [h2d(c.substring(1,3)),h2d(c.substring(3,5)),h2d(c.substring(5,7))];
		}else if(c.indexOf('rgb')==0){
			var bits = c.match(/[0-9\.]+/g);
			if(bits.length == 4) this.alpha = parseFloat(bits[3]);
			this.rgb = [parseInt(bits[0]),parseInt(bits[1]),parseInt(bits[2])];
			this.hex = "#"+d2h(this.rgb[0])+d2h(this.rgb[1])+d2h(this.rgb[2]);
		}else return {};
		this.hsv = rgb2hsv(this.rgb[0],this.rgb[1],this.rgb[2]);
		this.name = (n || "Name");
		var r,sat;
		for(r = 0, sat = 0; r < this.rgb.length ; r++){
			if(this.rgb[r] > 200) sat++;
		}
		this.text = (this.rgb[0] + this.rgb[1] + this.rgb[2] > 500 || sat > 1) ? "black" : "white";
		return this;
	}
	function getColour(pc,a,b){
		if(!b) b = a;
		return 'rgb('+parseInt(a.rgb[0] + (b.rgb[0]-a.rgb[0])*pc)+','+parseInt(a.rgb[1] + (b.rgb[1]-a.rgb[1])*pc)+','+parseInt(a.rgb[2] + (b.rgb[2]-a.rgb[2])*pc)+')';
	}
	function makeGradient(a,b){
		if(!b) b = a;
		return 'background: '+a.hex+'; background: -moz-linear-gradient(left, '+a.hex+' 0%, '+b.hex+' 100%);background: -webkit-linear-gradient(left, '+a.hex+' 0%,'+b.hex+' 100%);background: linear-gradient(to right, '+a.hex+' 0%,'+b.hex+' 100%);';
	}
	function setTextColor(hex){
		if(!hex) return '';
		var colour = new Colour(hex);
		hex = colour.hex;
		var L1 = getL(hex);
		var Lb = getL('#000000');
		var Lw = getL('#ffffff');
		var rb = (Math.max(L1, Lb) + 0.05) / (Math.min(L1, Lb) + 0.05);
		var rw = (Math.max(L1, Lw) + 0.05) / (Math.min(L1, Lw) + 0.05);
		if(L1 == Lw) return '#000000';
		return (rb > rw ? '#000000':'#FFFFFF');
	}
	function getL(c) {
		return (0.2126 * getsRGB(c.substr(1, 2)) + 0.7152 * getsRGB(c.substr(3, 2)) + 0.0722 * getsRGB(c.substr(-2)));
	}
	function getRGB(c) {
		try { var c = parseInt(c, 16); } catch (err) { var c = false; }
		return c;
	}
	function getsRGB(c) {
		c = getRGB(c) / 255;
		c = (c <= 0.03928) ? c / 12.92 : Math.pow(((c + 0.055) / 1.055), 2.4);
		return c;
	}

	return this;

}