/* Updates fa-icons.html with latest Font Awesome icons */

// Node Modules
const request = require("request");
const { safeLoad } = require("js-yaml");
const { writeFileSync } = require("fs");

// Dedent for Template Strings: https://gist.github.com/zenparsing/5dffde82d9acef19e43c
var dedent = (callSite, ...args) => {
	const format = str => {
		let size = -1;
		return str.replace(/\n(\s+)/g, (m, m1) => {
			if (size < 0) {
				size = m1.replace(/\t/g, "	").length;
			}
			return "\n" + m1.slice(Math.min(m1.length, size));
		});
	};
	if (typeof callSite === "string") {
		return format(callSite);
	}

	if (typeof callSite === "function") {
		return (...args) => format(callSite(...args));
	}

	let output = callSite
		.slice(0, args.length + 1)
		.map((text, i) => (i === 0 ? "" : args[i - 1]) + text)
		.join("");

	return format(output);
};

// Request options (proxy?)
var requestOptions = {
	proxy: ""
};

// Raw repo url
var rawRepo = "https://raw.githubusercontent.com/FortAwesome/Font-Awesome/v4.7.0/";

// Request urls
var urls = {
	yml: `${rawRepo}src/icons.yml`,
	svg: `${rawRepo}src/assets/font-awesome/fonts/fontawesome-webfont.svg`
};

// Base icon width
var iconWidth = 1792;

// Output SVG object
var svg = {
	begin: ({ name }) => dedent`<!--
		Polymer icon set generated from Font Awesome SVG Font
		https://github.com/vangware/fontawesome-iconset
		@element iron-iconset-svg
		@demo demo.html
		-->
		<link rel="import" href="../iron-icon/iron-icon.html">
		<link rel="import" href="../iron-iconset-svg/iron-iconset-svg.html">
		<iron-iconset-svg name="${name}" size="${iconWidth}">
		  <svg>
		    <defs>
	`,
	defs: Object.create(null),
	end: "\n    </defs>\n  </svg>\n</iron-iconset-svg>"
};

// Icon template
var template = ({
	name,
	path,
	scaleX,
	scaleY,
	shiftX,
	shiftY
}) => `      <g id="${name}" transform="scale(${scaleX} ${scaleY}) translate(${shiftX} ${shiftY})"><path d="${path}"></path></g>\n`;

// Icons object
var icons = Object.create(null);

// Pixel base size
var pixelBase = 128;

// Generate icon and addit to output svg
var generateIcon = (iconData, svgPath, params) => {
	"use strict";
	var size = iconWidth / params.horizAdvX,
		shiftX = -(-(iconWidth - params.horizAdvX) / 2),
		def;
	size = size > 1 ? 1 : size;
	def = template(Object.assign(Object.create(null), {
		name: iconData.id,
		path: svgPath
	}, params, {
		scaleX: size,
		scaleY: -size,
		shiftX: shiftX < 0 ? 0 : shiftX,
		shiftY: -(1280 + 2 * pixelBase)
	}));
	iconData.categories.forEach(category => {
		if (svg.defs[category]) {
			svg.defs[category].push(def);
		} else {
			svg.defs[category] = [def];
		}
	});
};

console.log("Request YML ...");
request(Object.assign(Object.create(null), 
	requestOptions, { url: urls.yml}), 
	(ymlError, ymlResponse, iconsYaml) => {
		"use strict";
		console.log("Request SVG ...");
		request(Object.assign(Object.create(null), 
			requestOptions, { url: urls.svg }),
			(svgError, svgResponse, fontData) => {
				
				var yamlIcons = safeLoad(iconsYaml).icons;

				// >= 4.6.0 didn't sanitize the lines, so we have newlines everywhere - remove them
				fontData = fontData.toString("utf8");
				fontData = fontData.replace(/(\r\n|\n|\r)/gm, ' ');
				fontData = fontData.replace(/  /gm, ' ');
				fontData = fontData.replace(/\/\>/gm, '/>\n');

				var lines = fontData.split("\n");

				yamlIcons.forEach(icon => {
					var categories = icon.categories;
					icons[icon.unicode] = {
						id: icon.id,
						categories: ["all"]
					};

					categories.forEach(category => {
						var normalizedCategory = category.toLowerCase().replace(/ /g, "-").replace("-icons", "");
						icons[icon.unicode].categories.push(normalizedCategory);
					});
				});

				console.log("Parsing icons ...");
				lines.forEach(line => {
					var match = line.match(/<glyph glyph-name="([^"]+)" unicode="&#x([^"]+);"\s*(?:horiz-adv-x="(\d+)")?\s*d="([^"]+)"/);

					if (match) {
						var unicode = match[2];
						var horizAdvX = match[3];
						var svgPath = match[4];
						if (icons[unicode]) {
							generateIcon(icons[unicode], svgPath, {
								horizAdvX: horizAdvX ? horizAdvX : 1536
							});
						}
					}
				});
				
				console.log("Writing icons to files ...");
				Object.keys(svg.defs).forEach(def => {
					console.log(`  fa-${def}.html`);
					writeFileSync(`fa-${def}.html`, svg.begin({
						name: (def === "all") ? "fa" : ("fa-" + def)
					}) + svg.defs[def].join("") + svg.end);
				});
				console.log("Done.");
		});
});
