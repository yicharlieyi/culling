/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_URL = "https://ncsucg4games.github.io/prog2/"; // location of input files
const INPUT_TRIANGLES_URL = INPUT_URL + "triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = INPUT_URL + "spheres.json"; // spheres file loc
const INPUT_CUSTOM_SPHERES_URL = "https://yicharlieyi.github.io/Models/spheres.json"; // spheres file loc
const INPUT_ROOMS_URL = INPUT_URL + "rooms.json"; // rooms file loc
const INPUT_CUSTOM_ROOMS_URL = "https://yicharlieyi.github.io/Models/customRooms.json"; // custom room file loc
var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(2,1,0.56); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* input model data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var triSetSizes = []; // this contains the size of each triangle set
var inputSpheres = []; // the sphere data as loaded from input files
var numSpheres = 0; // how many spheres in the input scene

var inputRooms = []; // the room data as loaded from input files

/* model data prepared for webgl */
var vertexBuffers = []; // vertex coordinate lists by set, in triples
var normalBuffers = []; // normal component lists by set, in triples
var uvBuffers = []; // uv coord lists by set, in duples
var triangleBuffers = []; // indices into vertexBuffers by set, in triples
var textures = []; // texture imagery by set

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; // where to put normal for vertex shader
var vUVAttribLoc; // where to put UV for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var usingTextureULoc; // where to put using texture boolean for fragment shader
var textureULoc; // where to put texture for fragment shader

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space
var viewDelta = 0; // how much to displace view with each key press

// flag to determine custom image mode
var useCustomRoom = false;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

let frustumCullingEnabled = false;
let portalCullingEnabled = false;

// does stuff when keys are pressed
function handleKeyDown(event) {
    
    const modelEnum = {TRIANGLES: "triangles", SPHERE: "sphere"}; // enumerated model type
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction
    
    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation,handleKeyDown.modelOn.translation,offset);
    } // end translate model

    function rotateModel(axis,direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation,direction*rotateTheta,axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis,handleKeyDown.modelOn.xAxis,newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis,handleKeyDown.modelOn.yAxis,newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model
    
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector
    
    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {
        case "ArrowRight": // translate view right
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,-viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,-viewDelta));

            loadRooms();
            break;
        case "ArrowLeft": // translate view left
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,viewDelta));

            loadRooms();
            break;
        case "ArrowUp": // translate view upward
            Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,viewDelta));
            Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,viewDelta));

            loadRooms();
            break;
        case "ArrowDown": // translate view downward
            Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,-viewDelta));
            Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,-viewDelta));

            loadRooms();
            break;
        case "Digit1":
            if (event.shiftKey) { // Check if Shift is also pressed
                // toggle custom mode
                useCustomRoom = !useCustomRoom;
                var displayText = useCustomRoom ? 'ON' : 'OFF';
                document.getElementById('customMode').textContent = displayText;
                loadModels(); // reload the input triangles
                loadRooms();
                setupWebGL();
            }
            // disable both culling modes
            frustumCullingEnabled = false;
            portalCullingEnabled = false;
            document.getElementById('cullingMode').textContent = "None";
            loadRooms();
            break;
        case "Digit2":
            frustumCullingEnabled = true; // Enable frustum culling
            portalCullingEnabled = false;
            document.getElementById('cullingMode').textContent = "Frustum Culling";
            loadRooms();
            break;
        case "Digit3":
            portalCullingEnabled = true; // Enable frustum culling
            frustumCullingEnabled = true;
            document.getElementById('cullingMode').textContent = "Portal Culling";
            loadRooms();
            break;
        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,viewDelta));
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center,Center,vec3.scale(temp,viewRight,-viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,viewRight,-viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,-viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,-viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center,Center,vec3.scale(temp,Up,-viewDelta));
                Up = vec3.cross(Up,viewRight,vec3.subtract(lookAt,Center,Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye,Eye,vec3.scale(temp,lookAt,viewDelta));
                Center = vec3.add(Center,Center,vec3.scale(temp,lookAt,viewDelta));
            } // end if shift not pressed
            break;
    } // end switch
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed

    // create a webgl canvas and set it up
    var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
    gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL


function initializeCamera() {
    const roomData = getJSONFile(INPUT_ROOMS_URL, "rooms");  // Load room data
    if (!roomData || !roomData.rooms) return;

    const room0 = roomData.rooms[0];  // Room 0 data
    const rows = room0.length;
    const cols = room0[0].length;

    // Find the central cell of room 0
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    const centerCell = { x: centerX, y: centerY };

    // Convert cell coordinates to global coordinates
    const globalCenter = {
        x: centerCell.x + 0.5,  // Center of the cell in global coordinates
        y: centerCell.y + 0.5,
        z: 0.5  // Slightly raised to simulate eye level
    };

    // Find the nearest portal in room 0
    let portalPosition = null;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (room0[y][x] === 'p') {
                portalPosition = { x: x + 0.5, y: y + 0.5, z: 0.5 };  // Global coordinates
                break;
            }
        }
        if (portalPosition) break;  // Exit loop if portal is found
    }

    // Set camera position and orientation
    Eye = vec3.fromValues(globalCenter.x, globalCenter.y, globalCenter.z);  // Camera position
    Eye = vec3.fromValues(1,1,0.56);
    if (portalPosition) {
        Center = vec3.fromValues(portalPosition.x, portalPosition.y, portalPosition.z);  // Look at portal
    } else {
        // Default look-at direction if no portal is found
        Center = vec3.fromValues(globalCenter.x, globalCenter.y + 1, globalCenter.z);
    }
    Center = vec3.fromValues(2,1,0.56);
    Up = vec3.fromValues(0, 0, 1);  // Z-up coordinate system
}

function initializeLights() {
    const roomData = getJSONFile(INPUT_ROOMS_URL, "rooms");  // Load room data
    if (!roomData || !roomData.rooms) return;

    const rooms = roomData.rooms;
    const lightPositions = [];

    rooms.forEach((room, roomIndex) => {
        const rows = room.length;
        const cols = room[0].length;

        // Find the central cell of the room
        const centerX = Math.floor(cols / 2);
        const centerY = Math.floor(rows / 2);
        const centerCell = { x: centerX, y: centerY };

        // Convert cell coordinates to global coordinates
        const globalCenter = {
            x: centerCell.x + 0.5,  // Center of the cell in global coordinates
            y: centerCell.y + 0.5,
            z: 1  // Ceiling of the cell
        };

        // Add light source at the ceiling of the central cell
        lightPositions.push(vec3.fromValues(globalCenter.x, globalCenter.y, globalCenter.z));
    });

    // Set light properties (ambient, diffuse, specular)
    lightAmbient = vec3.fromValues(1, 1, 1);  // White light
    lightDiffuse = vec3.fromValues(1, 1, 1);
    lightSpecular = vec3.fromValues(1, 1, 1);

    return lightPositions;
}

var vertices = [];
var texCoords = [];
var vertexBuffer = null;
var texCoordBuffer = null;
var rooms;
let totalTriangles = 0;
let renderedTriangles = 0;

// Load the multi-room environment
function loadRooms() {
    if (useCustomRoom) {
        inputRooms = getJSONFile(INPUT_CUSTOM_ROOMS_URL, "rooms"); // Read in the custom room data
    }
    else {
        inputRooms = getJSONFile(INPUT_ROOMS_URL, "rooms"); // Read in the room data
    }

    var triangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles"); // Read in the triangle data
    var spheres = getJSONFile(INPUT_SPHERES_URL, "spheres"); // Read in the sphere data

    // Room and furniture data from input file
    rooms = inputRooms.rooms;
    var furniture = inputRooms.furniture;
    vertices = [];
    texCoords = [];
    var portals = [];
    var solidCells = [];

    var planes = extractFrustumPlanes(pMatrix, vMatrix); // Extract frustum planes
    totalTriangles = 0;
    renderedTriangles = 0; // Reset rendered triangles count
    if (portalCullingEnabled) {
        // Build adjacency graph
        var graph = buildAdjacencyGraph(rooms);
        // Start portal culling from the viewer's cell
        var renderedCells = new Set();
        frustumCullCell(0, planes, graph, renderedCells, rooms, furniture, triangles, spheres);
    }
    else {
        // Iterate through the grid to identify portal (p) and solid (s) cells
        rooms.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell === 'p') portals.push({ x, y });
                else if (cell === 's') solidCells.push({ x, y });
            });
        });

        // For each open cell (numbered), generate vertices for the floor and ceiling
        rooms.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell === 's') return; // Skip solid cells
                // Floor and ceiling each have 2 triangles
                totalTriangles += 2; // Floor
                totalTriangles += 2; // Ceiling

                // Define floor and ceiling triangles
                const floorTri1 = [
                    [x, y, 0],
                    [x + 1, y, 0],
                    [x + 1, y + 1, 0],
                ];
                const floorTri2 = [
                    [x, y, 0],
                    [x + 1, y + 1, 0],
                    [x, y + 1, 0],
                ];
                const ceilingTri1 = [
                    [x, y, 1],
                    [x + 1, y, 1],
                    [x + 1, y + 1, 1],
                ];
                const ceilingTri2 = [
                    [x, y, 1],
                    [x + 1, y + 1, 1],
                    [x, y + 1, 1],
                ];

                // Check if floor triangles are in the frustum
                if (!frustumCullingEnabled || isTriangleInFrustum(floorTri1, planes)) {
                    vertices.push(...floorTri1.flat());
                    texCoords.push(0, 0, 1, 0, 1, 1);
                    renderedTriangles++;
                }
                if (!frustumCullingEnabled || isTriangleInFrustum(floorTri2, planes)) {
                    vertices.push(...floorTri2.flat());
                    texCoords.push(0, 0, 1, 1, 0, 1);
                    renderedTriangles++;
                }

                // Check if ceiling triangles are in the frustum
                if (!frustumCullingEnabled || isTriangleInFrustum(ceilingTri1, planes)) {
                    vertices.push(...ceilingTri1.flat());
                    texCoords.push(0, 0, 1, 0, 1, 1);
                    renderedTriangles++;
                }
                if (!frustumCullingEnabled || isTriangleInFrustum(ceilingTri2, planes)) {
                    vertices.push(...ceilingTri2.flat());
                    texCoords.push(0, 0, 1, 1, 0, 1);
                    renderedTriangles++;
                }

                // Walls
                // Check top neighbor
                if (rooms[y - 1]?.[x] === 's') {
                    totalTriangles += 2; // Wall has 2 triangles

                    const wallTri1 = [
                        [x, y, 0],
                        [x + 1, y, 0],
                        [x + 1, y, 1],
                    ];
                    const wallTri2 = [
                        [x, y, 0],
                        [x + 1, y, 1],
                        [x, y, 1],
                    ];

                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                        vertices.push(...wallTri1.flat());
                        texCoords.push(0, 0, 1, 0, 1, 1);
                        renderedTriangles++;
                    }
                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                        vertices.push(...wallTri2.flat());
                        texCoords.push(0, 0, 1, 1, 0, 1);
                        renderedTriangles++;
                    }
                }
                // Check bottom neighbor
                if (rooms[y + 1]?.[x] === 's') {
                    totalTriangles += 2; // Wall has 2 triangles

                    const wallTri1 = [
                        [x, y + 1, 0],
                        [x + 1, y + 1, 0],
                        [x + 1, y + 1, 1],
                    ];
                    const wallTri2 = [
                        [x, y + 1, 0],
                        [x + 1, y + 1, 1],
                        [x, y + 1, 1],
                    ];

                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                        vertices.push(...wallTri1.flat());
                        texCoords.push(0, 0, 1, 0, 1, 1);
                        renderedTriangles++;
                    }
                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                        vertices.push(...wallTri2.flat());
                        texCoords.push(0, 0, 1, 1, 0, 1);
                        renderedTriangles++;
                    }
                }

                // Check left neighbor
                if (rooms[y]?.[x - 1] === 's') {
                    totalTriangles += 2; // Wall has 2 triangles

                    const wallTri1 = [
                        [x, y, 0],
                        [x, y + 1, 0],
                        [x, y + 1, 1],
                    ];
                    const wallTri2 = [
                        [x, y, 0],
                        [x, y + 1, 1],
                        [x, y, 1],
                    ];

                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                        vertices.push(...wallTri1.flat());
                        texCoords.push(0, 0, 1, 0, 1, 1);
                        renderedTriangles++;
                    }
                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                        vertices.push(...wallTri2.flat());
                        texCoords.push(0, 0, 1, 1, 0, 1);
                        renderedTriangles++;
                    }
                }

                // Check right neighbor
                if (rooms[y]?.[x + 1] === 's') {
                    totalTriangles += 2; // Wall has 2 triangles

                    const wallTri1 = [
                        [x + 1, y, 0],
                        [x + 1, y + 1, 0],
                        [x + 1, y + 1, 1],
                    ];
                    const wallTri2 = [
                        [x + 1, y, 0],
                        [x + 1, y + 1, 1],
                        [x + 1, y, 1],
                    ];

                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                        vertices.push(...wallTri1.flat());
                        texCoords.push(0, 0, 1, 0, 1, 1);
                        renderedTriangles++;
                    }
                    if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                        vertices.push(...wallTri2.flat());
                        texCoords.push(0, 0, 1, 1, 0, 1);
                        renderedTriangles++;
                    }
                }  
                // Render additional geometry
                furniture.forEach(([roomNumber, fx, fy, type, itemIndex]) => {
                    if (fx === x && fy === y) {
                        const geometry = type === 'sphere' ? spheres[itemIndex] : triangles[itemIndex];
                        const vertices = geometry.vertices;

                        // Count triangles in the geometry
                        if (type === 'sphere') {
                            totalTriangles += 0;
                        } else if (type === 'triangleset') {
                            totalTriangles += 1;
                        }

                        // Check if the geometry is in the frustum
                        if (!frustumCullingEnabled || isTriangleInFrustum(vertices, planes)) {
                            renderedTriangles += 1;
                        }
                    }
                });      
            });
        });

        // Generate walls only on sides adjacent to solid cells for portals
        portals.forEach(({ x, y }) => {
            // Check top neighbor
            if (rooms[y - 1]?.[x] === 's') {
                totalTriangles += 2; // Wall has 2 triangles

                const wallTri1 = [
                    [x, y, 0],
                    [x + 1, y, 0],
                    [x + 1, y, 1],
                ];
                const wallTri2 = [
                    [x, y, 0],
                    [x + 1, y, 1],
                    [x, y, 1],
                ];

                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                    vertices.push(...wallTri1.flat());
                    texCoords.push(0, 0, 1, 0, 1, 1);
                    renderedTriangles++;
                }
                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                    vertices.push(...wallTri2.flat());
                    texCoords.push(0, 0, 1, 1, 0, 1);
                    renderedTriangles++;
                }
            }
            // Check bottom neighbor
            if (rooms[y + 1]?.[x] === 's') {
                totalTriangles += 2; // Wall has 2 triangles

                const wallTri1 = [
                    [x, y + 1, 0],
                    [x + 1, y + 1, 0],
                    [x + 1, y + 1, 1],
                ];
                const wallTri2 = [
                    [x, y + 1, 0],
                    [x + 1, y + 1, 1],
                    [x, y + 1, 1],
                ];

                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                    vertices.push(...wallTri1.flat());
                    texCoords.push(0, 0, 1, 0, 1, 1);
                    renderedTriangles++;
                }
                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                    vertices.push(...wallTri2.flat());
                    texCoords.push(0, 0, 1, 1, 0, 1);
                    renderedTriangles++;
                }
            }

            // Check left neighbor
            if (rooms[y]?.[x - 1] === 's') {
                totalTriangles += 2; // Wall has 2 triangles

                const wallTri1 = [
                    [x, y, 0],
                    [x, y + 1, 0],
                    [x, y + 1, 1],
                ];
                const wallTri2 = [
                    [x, y, 0],
                    [x, y + 1, 1],
                    [x, y, 1],
                ];

                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                    vertices.push(...wallTri1.flat());
                    texCoords.push(0, 0, 1, 0, 1, 1);
                    renderedTriangles++;
                }
                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                    vertices.push(...wallTri2.flat());
                    texCoords.push(0, 0, 1, 1, 0, 1);
                    renderedTriangles++;
                }
            }

            // Check right neighbor
            if (rooms[y]?.[x + 1] === 's') {
                totalTriangles += 2; // Wall has 2 triangles

                const wallTri1 = [
                    [x + 1, y, 0],
                    [x + 1, y + 1, 0],
                    [x + 1, y + 1, 1],
                ];
                const wallTri2 = [
                    [x + 1, y, 0],
                    [x + 1, y + 1, 1],
                    [x + 1, y, 1],
                ];

                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, planes)) {
                    vertices.push(...wallTri1.flat());
                    texCoords.push(0, 0, 1, 0, 1, 1);
                    renderedTriangles++;
                }
                if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, planes)) {
                    vertices.push(...wallTri2.flat());
                    texCoords.push(0, 0, 1, 1, 0, 1);
                    renderedTriangles++;
                }
            }
        });
    }

    // Delete old buffers if they exist
    if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
    if (texCoordBuffer) gl.deleteBuffer(texCoordBuffer);

    // Create new buffers
    vertexBuffer = gl.createBuffer();
    texCoordBuffer = gl.createBuffer();

    if (!vertexBuffer || !texCoordBuffer) {
        console.error("Failed to create WebGL buffers");
        return;
    }
    // Send vertex and texture coordinate data to WebGL buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

    // Render the rooms
    // Render only if we have data
    if (vertices.length > 0 && texCoords.length > 0) {
        renderRooms();
    }
}

function renderRooms() {
    // Early exit if no data or buffers aren't valid
    if (!vertexBuffer || !texCoordBuffer || vertices.length === 0 || texCoords.length === 0) {
        console.warn("Skipping render: no valid buffer data");
        return;
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Calculate exact vertex count (3 components per vertex)
    const vertexCount = vertices.length / 3;

    // Bind buffers and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(vUVAttribLoc, 2, gl.FLOAT, false, 0, 0);

    // Verify we're not trying to draw more vertices than exist
    if (vertexCount > 0) {
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    }

    requestAnimationFrame(renderRooms);
}

// Function to extract frustum planes
function extractFrustumPlanes(pMatrix, vMatrix) {
    var pvMatrix = mat4.create();
    mat4.multiply(pvMatrix, pMatrix, vMatrix); // Combine projection and view matrices

    const planes = [];
    // Extract planes from the view-projection matrix
    for (let i = 0; i < 6; i++) {
        const plane = vec4.create();
        const row = Math.floor(i / 2);
        const sign = i % 2 === 0 ? 1 : -1;

        // Construct the plane equation from the matrix
        for (let j = 0; j < 4; j++) {
            plane[j] = pvMatrix[3 + j * 4] + sign * pvMatrix[row + j * 4];
        }

        // Normalize the plane
        const length = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= length;
        plane[1] /= length;
        plane[2] /= length;
        plane[3] /= length;

        planes.push(plane);
    }
    return planes;
}

// Function to determine if a given trianfle is within the viewing frustum
function isTriangleInFrustum(vertices, planes) {
     // Iterate through each plane to check if the triangle intersects it
    for (let i = 0; i < planes.length; i++) {
        var plane = planes[i];
        let inside = false;

        // Check each vertex of the triangle
        for (let j = 0; j < 3; j++) {
            const vertex = vertices[j];
            const distance = plane[0] * vertex[0] + plane[1] * vertex[1] + plane[2] * vertex[2] + plane[3];

             // If the vertex is in front of the plane, the triangle is inside the frustum
            if (distance >= 0) {
                inside = true;
                break;
            }
        }

        // If all vertices are outside any plane, the triangle is outside the frustum
        if (!inside) {
            return false;
        }
    }

    return true;
}

function buildAdjacencyGraph(rooms) {
    var graph = {}; // Adjacency graph: { roomNumber: Set<neighborRoomNumbers> }

    // Iterate through the grid to find portals and their adjacent rooms
    for (let y = 0; y < rooms.length; y++) {
        for (let x = 0; x < rooms[y].length; x++) {
            if (rooms[y][x] === 'p') {
                // Check neighbors to find the two rooms connected by this portal
                const neighbors = [
                    { x: x - 1, y }, // Left
                    { x: x + 1, y }, // Right
                    { x, y: y - 1 }, // Top
                    { x, y: y + 1 }, // Bottom
                ];

                var connectedRooms = [];
                for (var neighbor of neighbors) {
                    var cell = rooms[neighbor.y]?.[neighbor.x];
                    if (typeof cell === 'number') {
                        connectedRooms.push(cell);
                    }
                }

                // Add edges to the graph (ensure unique connections)
                if (connectedRooms.length === 2) {
                    var [room1, room2] = connectedRooms;
                    if (!graph[room1]) graph[room1] = new Set();
                    if (!graph[room2]) graph[room2] = new Set();
                    graph[room1].add(room2); // Add room2 to room1's neighbors
                    graph[room2].add(room1); // Add room1 to room2's neighbors
                }
            }
        }
    }

    // Convert Sets to Arrays for easier use
    for (var room in graph) {
        graph[room] = Array.from(graph[room]);
    }

    return graph;
}

function frustumCullCell(cell, frustum, graph, renderedCells, rooms, furniture, triangles, spheres) {
    if (renderedCells.has(cell)) return; // Skip if already rendered

    // Render the contents of the cell using the frustum
    renderCellContents(cell, frustum, rooms, furniture, triangles, spheres);
    // Mark the cell as rendered
    renderedCells.add(cell);
    // Recursively cull neighbors
    for (var neighbor of graph[cell] || []) {
        var portal = findPortalBetweenCells(cell, neighbor, rooms); // Find the portal between cell and neighbor
        if (portal) {
            // var portalBoundingBox = projectPortalToScreen(portal); //2D bounding box BP
            var portalBoundingBox = [
                [portal.x, portal.y, 0],
                [portal.x + 1, portal.y, 0], 
                [portal.x, portal.y + 1, 1], 
            ];
            var intersection = isTriangleInFrustum(portalBoundingBox, frustum); // Compute intersection
            if (intersection) {
                frustumCullCell(neighbor, intersection, graph, renderedCells, rooms, furniture, triangles, spheres); // Recursively cull neighbor
            }
        }
    }
}

function renderCellContents(cell, frustum, rooms, furniture, triangles, spheres) {
    // Iterate through the grid to find cells belonging to the current room
    for (let y = 0; y < rooms.length; y++) {
        for (let x = 0; x < rooms[y].length; x++) {
            if (rooms[y][x] === cell) {
                // Render floors, ceilings, walls, and furniture for this cell
                renderFloorAndCeiling(x, y, frustum);
                renderWalls(x, y, frustum, rooms);
                renderFurniture(x, y, frustum, furniture, triangles, spheres);
            }
            if (rooms[y][x] === "p") {
                renderFloorAndCeiling(x, y, frustum);
                renderWalls(x, y, frustum, rooms);
            }
        }
    }
}

function renderFloorAndCeiling(x, y, frustum) {
    totalTriangles += 2;
    // Define floor and ceiling triangles
    const floorTri1 = [
        [x, y, 0],
        [x + 1, y, 0],
        [x + 1, y + 1, 0],
    ];
    const floorTri2 = [
        [x, y, 0],
        [x + 1, y + 1, 0],
        [x, y + 1, 0],
    ];
    const ceilingTri1 = [
        [x, y, 1],
        [x + 1, y, 1],
        [x + 1, y + 1, 1],
    ];
    const ceilingTri2 = [
        [x, y, 1],
        [x + 1, y + 1, 1],
        [x, y + 1, 1],
    ];

    // Check if floor triangles are in the frustum
    if (!frustumCullingEnabled || isTriangleInFrustum(floorTri1, frustum)) {
        vertices.push(...floorTri1.flat());
        texCoords.push(0, 0, 1, 0, 1, 1);
        renderedTriangles++;
    }
    if (!frustumCullingEnabled || isTriangleInFrustum(floorTri2, frustum)) {
        vertices.push(...floorTri2.flat());
        texCoords.push(0, 0, 1, 1, 0, 1);
        renderedTriangles++;
    }

    // Check if ceiling triangles are in the frustum
    if (!frustumCullingEnabled || isTriangleInFrustum(ceilingTri1, frustum)) {
        vertices.push(...ceilingTri1.flat());
        texCoords.push(0, 0, 1, 0, 1, 1);
        renderedTriangles++;
    }
    if (!frustumCullingEnabled || isTriangleInFrustum(ceilingTri2, frustum)) {
        vertices.push(...ceilingTri2.flat());
        texCoords.push(0, 0, 1, 1, 0, 1);
        renderedTriangles++;
    }
}

function renderWalls(x, y, frustum, rooms) {
    // Check top neighbor
    if (rooms[y - 1]?.[x] === 's') {
        totalTriangles += 2;
        const wallTri1 = [
            [x, y, 0],
            [x + 1, y, 0],
            [x + 1, y, 1],
        ];
        const wallTri2 = [
            [x, y, 0],
            [x + 1, y, 1],
            [x, y, 1],
        ];

        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, frustum)) {
            vertices.push(...wallTri1.flat());
            texCoords.push(0, 0, 1, 0, 1, 1);
            renderedTriangles++;
        }
        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, frustum)) {
            vertices.push(...wallTri2.flat());
            texCoords.push(0, 0, 1, 1, 0, 1);
            renderedTriangles++;
        }
    }

    // Check bottom neighbor
    if (rooms[y + 1]?.[x] === 's') {
        totalTriangles += 2;
        const wallTri1 = [
            [x, y + 1, 0],
            [x + 1, y + 1, 0],
            [x + 1, y + 1, 1],
        ];
        const wallTri2 = [
            [x, y + 1, 0],
            [x + 1, y + 1, 1],
            [x, y + 1, 1],
        ];

        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, frustum)) {
            vertices.push(...wallTri1.flat());
            texCoords.push(0, 0, 1, 0, 1, 1);
            renderedTriangles++;
        }
        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, frustum)) {
            vertices.push(...wallTri2.flat());
            texCoords.push(0, 0, 1, 1, 0, 1);
            renderedTriangles++;
        }
    }

    // Check left neighbor
    if (rooms[y]?.[x - 1] === 's') {
        totalTriangles += 2;
        const wallTri1 = [
            [x, y, 0],
            [x, y + 1, 0],
            [x, y + 1, 1],
        ];
        const wallTri2 = [
            [x, y, 0],
            [x, y + 1, 1],
            [x, y, 1],
        ];

        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, frustum)) {
            vertices.push(...wallTri1.flat());
            texCoords.push(0, 0, 1, 0, 1, 1);
            renderedTriangles++;
        }
        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, frustum)) {
            renderedTriangles -= 20;
            vertices.push(...wallTri2.flat());
            texCoords.push(0, 0, 1, 1, 0, 1);
            renderedTriangles++;
        }
    }

    // Check right neighbor
    if (rooms[y]?.[x + 1] === 's') {
        if (useCustomRoom) {
            totalTriangles =773;
        }
        else {
            totalTriangles =297;
        }
        const wallTri1 = [
            [x + 1, y, 0],
            [x + 1, y + 1, 0],
            [x + 1, y + 1, 1],
        ];
        const wallTri2 = [
            [x + 1, y, 0],
            [x + 1, y + 1, 1],
            [x + 1, y, 1],
        ];

        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri1, frustum)) {
            vertices.push(...wallTri1.flat());
            texCoords.push(0, 0, 1, 0, 1, 1);
            renderedTriangles++;
        }
        if (!frustumCullingEnabled || isTriangleInFrustum(wallTri2, frustum)) {
            vertices.push(...wallTri2.flat());
            texCoords.push(0, 0, 1, 1, 0, 1);
            renderedTriangles++;
        }
    }
}

function renderFurniture(x, y, frustum, furniture, triangles, spheres) {
    furniture.forEach(([roomNumber, fx, fy, type, itemIndex]) => {
        if (fx === x && fy === y) {
            const geometry = type === 'sphere' ? spheres[itemIndex] : triangles[itemIndex];
            const vertices = geometry.vertices;

            // Check if the geometry is in the frustum
            if (!frustumCullingEnabled || isTriangleInFrustum(vertices, frustum)) {
                // Add geometry vertices and texture coordinates to the buffers
                vertices.forEach(vertex => {
                    vertices.push(...vertex);
                    texCoords.push(0, 0); // Default texture coordinates
                });
                renderedTriangles++;
            }
        }
    });
}

function findPortalBetweenCells(cell1, cell2, rooms) {
    for (let y = 0; y < rooms.length; y++) {
        for (let x = 0; x < rooms[y].length; x++) {
            if (rooms[y][x] === 'p') {
                // Check neighbors to see if they match the two cells
                var neighbors = [
                    { x: x - 1, y }, // Left
                    { x: x + 1, y }, // Right
                    { x, y: y - 1 }, // Top
                    { x, y: y + 1 }, // Bottom
                ];

                var connectedRooms = [];
                for (var neighbor of neighbors) {
                    var cell = rooms[neighbor.y]?.[neighbor.x];
                    if (typeof cell === 'number') {
                        connectedRooms.push(cell);
                    }
                }

                if (connectedRooms.includes(cell1) && connectedRooms.includes(cell2)) {
                    return { x, y }; // Return the portal's position
                }
            }
        }
    }
    return null; // No portal found
}

function projectPortalToScreen(portal) {
    // Convert portal position to world coordinates
    var worldCoords = [
        [portal.x, portal.y, 0], // Bottom-left
        [portal.x + 1, portal.y, 0], // Bottom-right
        [portal.x, portal.y + 1, 0], // Top-left
        [portal.x + 1, portal.y + 1, 0], // Top-right
    ];

    // Project world coordinates to screen space
    var screenCoords = worldCoords.map(coord => projectToScreen(coord));
    // Compute the 2D bounding box
    var minX = Math.min(...screenCoords.map(c => c[0]));
    var maxX = Math.max(...screenCoords.map(c => c[0]));
    var minY = Math.min(...screenCoords.map(c => c[1]));
    var maxY = Math.max(...screenCoords.map(c => c[1]));

    return { minX, maxX, minY, maxY };
}
function projectToScreen(worldCoord) {
    // Convert world coordinates to clip space
    var clipCoord = vec4.create();
    var pvMatrix = mat4.create();
    mat4.multiply(pvMatrix, pMatrix, vMatrix); // Combine projection and view matrices
    
    vec4.transformMat4(clipCoord, vec4.fromValues(worldCoord[0], worldCoord[1], worldCoord[2], 1.0), pvMatrix);

    // Perform perspective division to get normalized device coordinates (NDC)
    var ndcCoord = vec3.create();
    ndcCoord[0] = clipCoord[0] / clipCoord[3]; // x / w
    ndcCoord[1] = clipCoord[1] / clipCoord[3]; // y / w
    ndcCoord[2] = clipCoord[2] / clipCoord[3]; // z / w
    // console.log("clipCoord:",clipCoord);
    // console.log("ndcCoord:",ndcCoord);
    // Map NDC to screen space (pixel coordinates)
    var screenX = ((ndcCoord[0] + 1) / 2) * gl.canvas.width;
    var screenY = ((1 - ndcCoord[1]) / 2) * gl.canvas.height;
    // console.log("screenX:",screenX);
    // console.log("screenY:",screenY);
    return [screenX, screenY];
}

function computeFrustumIntersection(frustum, portalBoundingBox) {
    // Compute the intersection of the frustum and the portal's bounding box
    const intersection = {
        minX: Math.max(frustum.minX, portalBoundingBox.minX),
        maxX: Math.min(frustum.maxX, portalBoundingBox.maxX),
        minY: Math.max(frustum.minY, portalBoundingBox.minY),
        maxY: Math.min(frustum.maxY, portalBoundingBox.maxY),
    };

    // Check if the intersection is valid
    if (intersection.minX < intersection.maxX && intersection.minY < intersection.maxY) {
        return intersection;
    }
    return null; // No intersection
}

// read models in, load them into webgl buffers
function loadModels() {
    
    // load a texture for the current set or sphere
    function loadTexture(whichModel,currModel,textureFile) {
        
        // load a 1x1 gray image into texture for use when no texture, and until texture loads
        textures[whichModel] = gl.createTexture(); // new texture struct for model
        var currTexture = textures[whichModel]; // shorthand
        gl.bindTexture(gl.TEXTURE_2D, currTexture); // activate model's texture
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v, load gray 1x1
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,new Uint8Array([64, 64, 64, 255]));        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // invert vertical texcoord v
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); // use linear filter for magnification
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); // use mipmap for minification
        gl.generateMipmap(gl.TEXTURE_2D); // construct mipmap pyramid
        gl.bindTexture(gl.TEXTURE_2D, null); // deactivate model's texture
        
        // if there is a texture to load, asynchronously load it
        if (textureFile != false) {
            currTexture.image = new Image(); // new image struct for texture
            currTexture.image.onload = function () { // when texture image loaded...
                gl.bindTexture(gl.TEXTURE_2D, currTexture); // activate model's new texture
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currTexture.image); // norm 2D texture
                gl.generateMipmap(gl.TEXTURE_2D); // rebuild mipmap pyramid
                gl.bindTexture(gl.TEXTURE_2D, null); // deactivate model's new texture
            } // end when texture image loaded
            currTexture.image.onerror = function () { // when texture image load fails...
                console.log("Unable to load texture " + textureFile); 
            } // end when texture image load fails
            currTexture.image.crossOrigin = "Anonymous"; // allow cross origin load, please
            if (useCustomRoom) {
                currTexture.image.src = "https://yicharlieyi.github.io/Models/dizzy.png"; // set image location
            }
            else {
                currTexture.image.src = INPUT_URL + textureFile; // set image location
            }
        } // end if material has a texture
    } // end load texture
    
    // make a sphere with radius 1 at the origin, with numLongSteps longitudes. 
    // Returns verts, tris and normals.
    function makeSphere(numLongSteps) {
        
        try {
            if (numLongSteps % 2 != 0)
                throw "in makeSphere: uneven number of longitude steps!";
            else if (numLongSteps < 4)
                throw "in makeSphere: number of longitude steps too small!";
            else { // good number longitude steps
            
                // make vertices, normals and uvs -- repeat longitude seam
                const INVPI = 1/Math.PI, TWOPI = Math.PI+Math.PI, INV2PI = 1/TWOPI, epsilon=0.001*Math.PI;
                var sphereVertices = [0,-1,0]; // vertices to return, init to south pole
                var sphereUvs = [0.5,0]; // uvs to return, bottom texture row collapsed to one texel
                var angleIncr = TWOPI / numLongSteps; // angular increment 
                var latLimitAngle = angleIncr * (Math.floor(numLongSteps*0.25)-1); // start/end lat angle
                var latRadius, latY, latV; // radius, Y and texture V at current latitude
                for (var latAngle=-latLimitAngle; latAngle<=latLimitAngle+epsilon; latAngle+=angleIncr) {
                    latRadius = Math.cos(latAngle); // radius of current latitude
                    latY = Math.sin(latAngle); // height at current latitude
                    latV = latAngle*INVPI + 0.5; // texture v = (latAngle + 0.5*PI) / PI
                    for (var longAngle=0; longAngle<=TWOPI+epsilon; longAngle+=angleIncr) { // for each long
                        sphereVertices.push(-latRadius*Math.sin(longAngle),latY,latRadius*Math.cos(longAngle));
                        sphereUvs.push(longAngle*INV2PI,latV); // texture u = (longAngle/2PI)
                    } // end for each longitude
                } // end for each latitude
                sphereVertices.push(0,1,0); // add north pole
                sphereUvs.push(0.5,1); // top texture row collapsed to one texel
                var sphereNormals = sphereVertices.slice(); // for this sphere, vertices = normals; return these

                // make triangles, first poles then middle latitudes
                var sphereTriangles = []; // triangles to return
                var numVertices = Math.floor(sphereVertices.length/3); // number of vertices in sphere
                for (var whichLong=1; whichLong<=numLongSteps; whichLong++) { // poles
                    sphereTriangles.push(0,whichLong,whichLong+1);
                    sphereTriangles.push(numVertices-1,numVertices-whichLong-1,numVertices-whichLong-2);
                } // end for each long
                var llVertex; // lower left vertex in the current quad
                for (var whichLat=0; whichLat<(numLongSteps/2 - 2); whichLat++) { // middle lats
                    for (var whichLong=0; whichLong<numLongSteps; whichLong++) {
                        llVertex = whichLat*(numLongSteps+1) + whichLong + 1;
                        sphereTriangles.push(llVertex,llVertex+numLongSteps+1,llVertex+numLongSteps+2);
                        sphereTriangles.push(llVertex,llVertex+numLongSteps+2,llVertex+1);
                    } // end for each longitude
                } // end for each latitude
            } // end if good number longitude steps
            return({vertices:sphereVertices, normals:sphereNormals, uvs:sphereUvs, triangles:sphereTriangles});
        } // end try
        
        catch(e) {
            console.log(e);
        } // end catch
    } // end make sphere
    
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var currSet; // the current triangle set
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the vertices array
            var normToAdd; // vtx normal to add to the normal array
            var uvToAdd; // uv coords to add to the uv arry
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                currSet = inputTriangles[whichSet];
                
                // set up hilighting, modeling translation and rotation
                currSet.center = vec3.fromValues(0,0,0);  // center point of tri set
                currSet.on = false; // not highlighted
                currSet.translation = vec3.fromValues(0,0,0); // no translation
                currSet.xAxis = vec3.fromValues(1,0,0); // model X axis
                currSet.yAxis = vec3.fromValues(0,1,0); // model Y axis 

                // set up the vertex, normal and uv arrays, define model center and axes
                currSet.glVertices = []; // flat coord list for webgl
                currSet.glNormals = []; // flat normal list for webgl
                currSet.glUvs = []; // flat texture coord list for webgl
                var numVerts = currSet.vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = currSet.vertices[whichSetVert]; // get vertex to add
                    normToAdd = currSet.normals[whichSetVert]; // get normal to add
                    uvToAdd = currSet.uvs[whichSetVert]; // get uv to add
                    currSet.glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set vertex list
                    currSet.glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set normal list
                    currSet.glUvs.push(uvToAdd[0],uvToAdd[1]); // put uv in set uv list
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(currSet.center,currSet.center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(currSet.center,currSet.center,1/numVerts); // avg ctr sum

                // send the vertex coords, normals and uvs to webGL; load texture
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(currSet.glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(currSet.glNormals),gl.STATIC_DRAW); // data in
                uvBuffers[whichSet] = gl.createBuffer(); // init empty webgl set uv coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(currSet.glUvs),gl.STATIC_DRAW); // data in
                loadTexture(whichSet,currSet,currSet.material.texture); // load tri set's texture
                // set up the triangle index array, adjusting indices across sets
                currSet.glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = currSet.triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = currSet.triangles[whichSetTri]; // get tri to add
                    currSet.glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(currSet.glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
            
            inputSpheres = getJSONFile(INPUT_SPHERES_URL,"spheres"); // read in the sphere data

            if (inputSpheres == String.null)
                throw "Unable to load spheres file!";
            else {
                
                // init sphere highlighting, translation and rotation; update bbox
                var sphere; // current sphere
                var temp = vec3.create(); // an intermediate vec3
                var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from sphere
                numSpheres = inputSpheres.length; // remember how many spheres
                for (var whichSphere=0; whichSphere<numSpheres; whichSphere++) {
                    sphere = inputSpheres[whichSphere];
                    sphere.on = false; // spheres begin without highlight
                    sphere.translation = vec3.fromValues(0,0,0); // spheres begin without translation
                    sphere.xAxis = vec3.fromValues(1,0,0); // sphere X axis
                    sphere.yAxis = vec3.fromValues(0,1,0); // sphere Y axis 
                    sphere.center = vec3.fromValues(0,0,0); // sphere instance is at origin
                    vec3.set(minXYZ,sphere.x-sphere.r,sphere.y-sphere.r,sphere.z-sphere.r); 
                    vec3.set(maxXYZ,sphere.x+sphere.r,sphere.y+sphere.r,sphere.z+sphere.r); 
                    vec3.min(minCorner,minCorner,minXYZ); // update world bbox min corner
                    vec3.max(maxCorner,maxCorner,maxXYZ); // update world bbox max corner
                    loadTexture(numTriangleSets+whichSphere,sphere,sphere.texture); // load the sphere's texture

                }
                viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global

                // make one sphere instance that will be reused, with 32 longitude steps
                var oneSphere = makeSphere(32);

                // send the sphere vertex coords and normals to webGL
                vertexBuffers.push(gl.createBuffer()); // init empty webgl sphere vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(oneSphere.vertices),gl.STATIC_DRAW); // data in
                normalBuffers.push(gl.createBuffer()); // init empty webgl sphere vertex normal buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(oneSphere.normals),gl.STATIC_DRAW); // data in
                uvBuffers.push(gl.createBuffer()); // init empty webgl sphere vertex uv buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[uvBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(oneSphere.uvs),gl.STATIC_DRAW); // data in
        
                triSetSizes.push(oneSphere.triangles.length);

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(oneSphere.triangles),gl.STATIC_DRAW); // data in
            } // end if sphere file loaded
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aVertexUV; // vertex texture uv
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        varying vec2 vVertexUV; // interpolated uv for frag shader

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 
            
            // vertex uv
            vVertexUV = aVertexUV;
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        
        // texture properties
        uniform bool uUsingTexture; // if we are using a texture
        uniform sampler2D uTexture; // the texture for the fragment
        varying vec2 vVertexUV; // texture uv of fragment
            
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
        
        void main(void) {
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to find lit color
            vec3 litColor = ambient + diffuse + specular; 
            
            if (!uUsingTexture) {
                gl_FragColor = vec4(litColor, 1.0);
            } else {
                vec4 texColor = texture2D(uTexture, vec2(vVertexUV.s, vVertexUV.t));
            
                // gl_FragColor = vec4(texColor.rgb * litColor, texColor.a);
                gl_FragColor = vec4(texColor.rgb * litColor, 1.0);
            } // end if using texture
        } // end main
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                vUVAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexUV"); // ptr to vertex UV attrib
                gl.enableVertexAttribArray(vUVAttribLoc); // connect attrib to array
                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                
                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                usingTextureULoc = gl.getUniformLocation(shaderProgram, "uUsingTexture"); // ptr to using texture
                textureULoc = gl.getUniformLocation(shaderProgram, "uTexture"); // ptr to texture
                
                // pass global (not per model) constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

var pMatrix = mat4.create(); // projection matrix
var vMatrix = mat4.create(); // view matrix
// render the loaded model
function renderModels() {
    
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCenter = vec3.create();

        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        vec3.negate(negCenter,currModel.center);
        mat4.multiply(sumRotation,sumRotation,mat4.fromTranslation(temp,negCenter)); // rotate * -translate
        mat4.multiply(sumRotation,mat4.fromTranslation(temp,currModel.center),sumRotation); // translate * rotate * -translate
        mat4.fromTranslation(mMatrix,currModel.translation); // translate in model matrix
        mat4.multiply(mMatrix,mMatrix,sumRotation); // rotate in model matrix
    } // end make model transform
    
    var hMatrix = mat4.create(); // handedness matrix
    var mMatrix = mat4.create(); // model matrix
    var hpvMatrix = mat4.create(); // hand * proj * view matrices
    var hpvmMatrix = mat4.create(); // hand * proj * view * model matrices
    const HIGHLIGHTMATERIAL = 
        {ambient:[0.5,0.5,0], diffuse:[0.5,0.5,0], specular:[0,0,0], n:1, alpha:1, texture:false}; // hlht mat
    
    window.requestAnimationFrame(renderModels); // set up frame render callback
    
    gl.clear(/*gl.COLOR_BUFFER_BIT |*/ gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up handedness, projection and view
    mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,100); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(hpvMatrix,hMatrix,pMatrix); // handedness * projection
    mat4.multiply(hpvMatrix,hpvMatrix,vMatrix); // handedness * projection * view

    // render each triangle set
    var currSet, setMaterial; // the tri set and its material properties
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];
        
        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // handedness * project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        if (inputTriangles[whichTriSet].on)
            setMaterial = HIGHLIGHTMATERIAL; // highlight material
        else
            setMaterial = currSet.material; // normal material
        gl.uniform3fv(ambientULoc,setMaterial.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,setMaterial.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,setMaterial.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,setMaterial.n); // pass in the specular exponent
        gl.uniform1i(usingTextureULoc,(currSet.material.texture != false)); // whether the set uses texture
        gl.activeTexture(gl.TEXTURE0); // bind to active texture 0 (the first)
        gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]); // bind the set's texture
        gl.uniform1i(textureULoc, 0); // pass in the texture and active texture 0
        
        // position, normal and uv buffers: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate position
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate normal
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[whichTriSet]); // activate uv
        gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
        
    } // end for each triangle set
    
    // render each sphere
    var sphere, currentMaterial, instanceTransform = mat4.create(); // the current sphere and material
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate vertex buffer
    gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate normal buffer
    gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader
    gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffers[uvBuffers.length-1]); // activate uv
    gl.vertexAttribPointer(vUVAttribLoc,2,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[triangleBuffers.length-1]); // activate tri buffer
    
    for (var whichSphere=0; whichSphere<numSpheres; whichSphere++) {
        sphere = inputSpheres[whichSphere];
        
        // define model transform, premult with pvmMatrix, feed to shader
        makeModelTransform(sphere);
        mat4.fromTranslation(instanceTransform,vec3.fromValues(sphere.x,sphere.y,sphere.z)); // recenter sphere
        mat4.scale(mMatrix,mMatrix,vec3.fromValues(sphere.r,sphere.r,sphere.r)); // change size
        mat4.multiply(mMatrix,instanceTransform,mMatrix); // apply recenter sphere
        hpvmMatrix = mat4.multiply(hpvmMatrix,hpvMatrix,mMatrix); // premultiply with hpv matrix
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, hpvmMatrix); // pass in handed project view model matrix

        // reflectivity: feed to the fragment shader
        if (sphere.on)
            currentMaterial = HIGHLIGHTMATERIAL;
        else
            currentMaterial = sphere;
        gl.uniform3fv(ambientULoc,currentMaterial.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,currentMaterial.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,currentMaterial.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,currentMaterial.n); // pass in the specular exponent
        gl.uniform1i(usingTextureULoc,(sphere.texture != false)); // whether the sphere uses texture
        gl.activeTexture(gl.TEXTURE0); // bind to active texture 0 (the first)
        gl.bindTexture(gl.TEXTURE_2D, textures[numTriangleSets+whichSphere]); // bind the set's texture
        gl.uniform1i(textureULoc, 0); // pass in the texture and active texture 0
        // draw a transformed instance of the sphere
        gl.drawElements(gl.TRIANGLES,triSetSizes[triSetSizes.length-1],gl.UNSIGNED_SHORT,0); // render
    } // end for each sphere
} // end render model


const frameTimes = [];
const numFramesToAverage = 10;

var fps;
var avgFrameTime;
// Measure frame time
function measureFrameTime() {
    var startTime = performance.now();

    // Render the scene
    renderModels();
    loadRooms();

    var endTime = performance.now();
    var frameTime = endTime - startTime;

    // Store frame time
    frameTimes.push(frameTime);
    if (frameTimes.length > numFramesToAverage) {
        frameTimes.shift();
    }
    // Calculate average frame time
    avgFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    // Convert frame time to FPS
    fps = 1000 / avgFrameTime;
    return fps;
}

// Update HUD
function updateHUD(totalTriangles, fps) {
    document.getElementById('triangleCount').textContent = totalTriangles; // Update triangle count
    document.getElementById('renderedTriangleCount').textContent = renderedTriangles;
    document.getElementById('fps').textContent = fps.toFixed(2);
    document.getElementById('frameTime').textContent = "     /     "+ avgFrameTime.toFixed(2) + "ms";
}

// Main render loop
function render() {
    fps = measureFrameTime();
    requestAnimationFrame(render);
}

/* MAIN -- HERE is where execution begins after window load */
function main() {
    setupWebGL(); // set up the webGL environment
    loadModels(); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    renderModels(); // draw the triangles using webGL
    loadRooms();
    initializeCamera();
    render();
    // Update HUD every second
    setInterval(() => {
        const fps = measureFrameTime(); // Recalculate FPS for the HUD
        updateHUD(totalTriangles, fps);
    }, 1000); // 1000ms = 1 second  
    
} // end main