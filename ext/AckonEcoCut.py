
import os.path
import math
import inkex 
import cspsubdiv 
import cubicsuperpath 
import simplepath 
import simpletransform 
from itertools import count
import os
import re
import simpletransform 
from inkex import etree 

WORKING_AREA_ID = "eu.EcoCut.inkscape.workarea"

CLOSE_DISTANCE = 0.5

inkex.localize()

class EcoCut2D(inkex.Effect):

    def __init__(self):  

        inkex.Effect.__init__(self)

        self.doc_height = 0

        self.define_command_line_options()

    def define_command_line_options(self):

        self.OptionParser.add_option("-f", "--filename", action="store", type="string",
                                     dest="filename", default="nombre",
                                     help=("Basename of the generated G-CODE file (will have .nc "
                                           "extension and will be saved on Desktop"))
        self.OptionParser.add_option("-x", "--dim-x", action="store", type="float", dest="dim_x",
                                     default=1250.0, help="Workpiece X dimension in mm")
        self.OptionParser.add_option("-y", "--dim-y", action="store", type="float", dest="dim_y",
                                     default=600.0, help="Workpiece Y dimension in mm")

        self.OptionParser.add_option("-s", "--speed", action="store", type="float",
                                     dest="speed", default=300, help="Cutting speed in mm/min")

        self.OptionParser.add_option("-e", "--temperatura", action="store", type="float",
                                     dest="temperatura", default=1000, help="Temperatura del alambre")

        self.OptionParser.add_option("-d", "--directoriocla", action="store", type="string",
                                     dest="directoriocla", default="escribi aca el camino al directorio",
                                     help=("directorio"))

        self.OptionParser.add_option("-b", "--flatness", action="store", type="float",
                                     dest="flatness", default=0.1,
                                     help="Flatness (for bezier curves)")
        self.OptionParser.add_option("-c", "--square", action="store", type="inkbool",
                                     dest="square", default=False,
                                     help="Cut along margin at the end")
        self.OptionParser.add_option("-m", "--margin", action="store", type="float",
                                     dest="margin", default="0.0", help=("Margin around path in"
                                                                         "mm"))

        self.OptionParser.add_option("-p", "--draw-toolpath", action="store", type="inkbool",
                                     dest="draw_toolpath", default=True,
                                     help="Draws the path of the tool")
        self.OptionParser.add_option("-a", "--auto-close-path", action="store", type="inkbool",
                                     dest="auto_close_path", default=True,
                                     help=("Automatically close open paths by joining start with "
                                           "end"))

        self.OptionParser.add_option("", "--active-tab", action="store", type="string",
                                     dest="active_tab", default='setup', help="Active tab.")

    def effect(self):

        to_mm = lambda value: self.uutounit(value, 'mm')

        to_uu = lambda value: self.unittouu(str(value) + "mm")

        self.doc_height = to_mm(self.unittouu(self.document.getroot().get('height')))

        working_area_generator = WorkingAreaGenerator(self.doc_height, to_uu, WORKING_AREA_ID)
        working_area_generator.set_size(self.options.dim_x, self.options.dim_y)
        working_area_generator.upsert(self.current_layer)

        if not self.options.ids:

            inkex.debug(_(("Ningun Vector seleccionado, por favor seleccione los Vectores "
            				"para generar el archivo de corte .nc")))

        else:

            paths_extractor = PathsExtractor(self.selected.values(), self.doc_height, to_mm,
                                             WORKING_AREA_ID, FlattenBezier(self.options.flatness),
                                             self.options.auto_close_path)
            paths_extractor.extract()

            border = None
            if self.options.square:
                border = Border(paths_extractor.paths(), self.options.margin)
                painter = BorderPainter(border)
                painter.paint(working_area_generator)

            paths_joiner = PathsJoiner(paths_extractor.paths(), CLOSE_DISTANCE)
            paths_joiner.unite()

            tool_path_generator = CuttingToolPathsGenerator(paths_joiner.union_path(),
                                                            CLOSE_DISTANCE, border)
            tool_path_generator.generate()

            if self.options.draw_toolpath:
                painter = ToolPathPainter(tool_path_generator.path())
                painter.paint(working_area_generator)

            gcode_generator = CuttingGCodeGenerator(tool_path_generator.path(), self.options.speed, self.options.temperatura)
            gcode_generator.generate()

            filename = gcode_filename(self.options.filename, self.options.directoriocla)  
            write_gcode_file(gcode_generator.gcode(), filename)

            stats = PathStatistics(tool_path_generator.path(), self.options.dim_x,
                                   self.options.dim_y, self.options.speed)

            message = (_("El archivo .nc fue grabado como ") + filename +
                       _(". Tiempo estimado de corte: ") + str(stats.working_time_min()) +
                       _(" minutos"))
            if not stats.is_path_inside_workpiece():
                message += _(" ")

            inkex.debug(message)

def distance(point1, point2):

    vector = [point1[0] - point2[0], point1[1] - point2[1], point1[2] - point2[2]]
    return math.sqrt(vector[0]**2 + vector[1]**2 + vector[2]**2)

class CuttingGCodeGenerator(object):

    def __init__(self, tool_path, speed, temperatura):

        self.tool_path = tool_path
        self.speed = speed
        self.gcode_str = None

        self.temperatura = temperatura

    def generate(self):

        if not self.tool_path:
            self.gcode_str = None
            return

        self.gcode_str = "G0Z0\n"

        self.gcode_str +="M03 S" + str(int(self.temperatura)) + "\n"

        self.gcode_str += "G04P1\n"

        self.gcode_str += "G01 F{:5.3f}\n".format(self.speed) + "\n"

        contador = 0
        anteultimo = len (self.tool_path) -1

        for point in self.tool_path:

            if ( contador == 2 ):
                self.gcode_str += "G04P0.5\n"

            if ( contador == anteultimo ):
                self.gcode_str += "G04P0.5\n"

            self.append_to_gcode(point)

            contador = contador + 1

        self.gcode_str += "M5\n"

    def append_to_gcode(self, point):

        self.gcode_str += "G01 X{:5.3f} Y{:5.3f}\n".format(point[0], point[1])

    def gcode(self):

        return self.gcode_str

class ToolPathPainter(object):

    def __init__(self, path):

        self.path = path
        self.working_area = None

    def paint(self, working_area):

        self.working_area = working_area
        if self.path:
            inkex.etree.SubElement(self.working_area.get_element(), "path", {
                'd': self.transform_path(),
                'style': "stroke:rgb(255,0,0)"
            })

    def transform_path(self):

        def convert_point(point):

            svg_x = point[0] * self.working_area.get_factor()
            svg_y = (self.working_area.get_dim_y() - point[1]) * self.working_area.get_factor()

            return "{},{}".format(svg_x, svg_y)

        str_path = "M {} L".format(convert_point((0.0, 0.0)))
        for point in self.path:
            str_path += " {}".format(convert_point(point))

        return str_path

class EcoCutError(Exception):

    def __init__(self, error_code):

        Exception.__init__(self)
        self.error_code = error_code

    def exit_code(self):

        return self.error_code

    def to_string(self):

        return _("Unknown error, error code: ") + str(self.error_code)

class EcoCutIOError(EcoCutError):

    def __init__(self, filename, message):

        EcoCutError.__init__(self, 1)

        self.filename = filename
        self.message = message

    def to_string(self):

        return _("Error while operating on file ") + self.filename + ", " + self.message

class UnrecognizedSVGElement(EcoCutError):

    def __init__(self, element):

        EcoCutError.__init__(self, 2)

        self.element = element

    def to_string(self):

        return _("Error, convierta los objetos a trayectos: ") + self.element

class InvalidCuttingPath(EcoCutError):

    def __init__(self, reason):

        EcoCutError.__init__(self, 3)

        self.reason = reason

    def to_string(self):

        return _("Invalid cutting path, reason: ") + self.reason

class InvalidWorkpieceDimensions(EcoCutError):

    def __init__(self, machine_width, machine_height):

        EcoCutError.__init__(self, 4)

        self.machine_width = machine_width
        self.machine_height = machine_height

    def to_string(self):

        return (_("Piece too big: maximum allowed dimensions for the selected machine is ") +
                "{:.1f}X{:.1f}".format(self.machine_width, self.machine_height))

class FlattenBezier(object):

    def __init__(self, flatness):

        self.flatness = flatness

    def __call__(self, curve):

        p = cubicsuperpath.parsePath(curve) 
        cspsubdiv.cspsubdiv(p, self.flatness)
        np = [] 
        for sp in p: 
            first = True
            for csp in sp:
                cmd = 'L'
                if first:
                    cmd = 'M'
                first = False
                np.append([cmd, [csp[1][0], csp[1][1]]])

        return np

class PathsExtractor(object):

    def __init__(self, elements, page_height, to_mm, working_area_id, flatten=None,
                 auto_close_path=False):

        self.elements = [e for e in elements if e.get("id") != working_area_id]

        self.extracted_paths = []
        self.transform_stack = []
        self.page_height = page_height
        self.to_mm = to_mm
        self.flatten = flatten
        self.auto_close_path = auto_close_path

    def get_elements(self):

        return self.elements

    def extract(self):

        def get_all_ancestors(element):

            ancestors = []
            cur_element = element
            while cur_element.getparent() is not None:
                cur_parent = cur_element.getparent()
                ancestors.append(cur_parent)
                cur_element = cur_parent
            ancestors.reverse()
            return ancestors

        for element in self.elements:

            ancestors = get_all_ancestors(element)
            for anc in ancestors:
                self.push_transformation(anc)

            self.generate_path_from_element(element)

            self.transform_stack = []

    def extract_from_list(self, elements):

        for element in elements:
            self.generate_path_from_element(element)

    def generate_path_from_element(self, element):

        self.push_transformation(element)

        if element.tag == inkex.addNS("path", "svg"):
            self.path_from_svg_path(element)
        elif element.tag == inkex.addNS("g", "svg"):
            self.extract_from_list(element)
        else:
            raise UnrecognizedSVGElement(element.tag)

        self.pop_transformation()

    def push_transformation(self, element):

        self.transform_stack.append(simpletransform.parseTransform(element.get("transform"),
                                                                   self.current_transform()))

    def current_transform(self):

        if not self.transform_stack:
            return [[1, 0, 0], [0, 1, 0]]

        return self.transform_stack[-1]

    def pop_transformation(self):

        self.transform_stack.pop()

    def path_from_svg_path(self, element):

        def to_point(point):

            transformed_point = [point[1][0], point[1][1]]
            simpletransform.applyTransformToPoint(self.current_transform(), transformed_point)

            return (self.to_mm(transformed_point[0]),
                    self.page_height - self.to_mm(transformed_point[1]))

        path_string = element.get('d')
        svg_path = self.flatten(path_string) if self.flatten else simplepath.parsePath(path_string)
        path = []

        for point in svg_path:
            if point[0] == 'M':
                if path:
                    self.close_path_if_needed(path)
                    self.extracted_paths.append(path)
                    path = []

                path.append(to_point(point))
            elif point[0] == 'L':
                path.append(to_point(point))
            elif point[0] == 'Z':
                if path:
                    path.append(path[0])
                    self.extracted_paths.append(path)
                    path = []
            else:
                raise UnrecognizedSVGElement("path element '{}'".format(point[0]))

        if path:
            self.close_path_if_needed(path)
            self.extracted_paths.append(path)

    def close_path_if_needed(self, path):

        if self.auto_close_path:
            if path[0] != path[-1]:
                path.append(path[0])

    def paths(self):

        return self.extracted_paths

def gcode_filename(basename, path):

    all_files = os.listdir(path)

    reg_expr = re.escape(basename) + "-(\\d{3}).nc"
    filtered = [f for f in all_files if re.match(reg_expr, f)]
    filtered.sort()

    sequence_number = 0
    if filtered:
        match = re.match(reg_expr, filtered[-1])   
        sequence_number = int(match.group(1)) + 1   

    return os.path.join(path, basename + "-{:03}.nc".format(sequence_number))

def write_gcode_file(gcode, filename):

    try:
        outfile = open(filename, "w")
        try:
            outfile.write(gcode)
        except IOError:
            raise EcoCutIOError(filename,
                                    _("Error when trying to write file, it might be corrupted"))
        finally:
            outfile.close()
    except IOError:
        raise EcoCutIOError(filename, _("Error when trying to open file"))

def squared_length(vector):

    return vector[0]**2 + vector[1]**2

def length(vector):

    return math.sqrt(squared_length(vector))

def squared_distance(point1, point2):

    vector = [point1[0] - point2[0], point1[1] - point2[1]]
    return squared_length(vector)

def distance(point1, point2):

    vector = [point1[0] - point2[0], point1[1] - point2[1]]
    return length(vector)

def verify_path_closed(path, close_distance):

    if path and (len(path) > 1) and (distance(path[0], path[-1]) > close_distance):
        raise InvalidCuttingPath(_("path is not closed"))

def point_path_squared_distance(point, path):

    nearest_index = 0
    nearest_distance = squared_distance(point, path[0])
    for (idx, path_point) in zip(count(1), path[1:]):
        dist = squared_distance(point, path_point)
        if dist < nearest_distance:
            nearest_index = idx
            nearest_distance = dist

    return (nearest_distance, nearest_index)

def rotate_closed_path(path, new_start):

    new_path = []

    if not path:
        return new_path

    if (new_start == 0) or (new_start >= len(path) - 1):
        return path

    new_path += path[new_start:]

    new_path += path[1:(new_start + 1)]

    return new_path

def invert_transform(mat):

    det = mat[0][0]*mat[1][1] - mat[0][1]*mat[1][0]
    result = []
    if det != 0:  

        a11 = mat[1][1]/det
        a12 = -mat[0][1]/det
        a21 = -mat[1][0]/det
        a22 = mat[0][0]/det

        a13 = -(a11*mat[0][2] + a12*mat[1][2])
        a23 = -(a21*mat[0][2] + a22*mat[1][2])
        result = [[a11, a12, a13], [a21, a22, a23]]
    else:
        result = [[0, 0, -mat[0][2]], [0, 0, -mat[1][2]]]

    return result

class WorkingAreaGenerator(object):

    def __init__(self, page_height, to_uu, working_area_id):

        self.area = None
        self.factor = None
        self.view_box_height = None
        self.dim_x = 1250.0
        self.dim_y = 600.0
        self.page_height = page_height
        self.to_uu = to_uu
        self.working_area_id = working_area_id

    def set_size(self, dim_x, dim_y):

        self.dim_x = dim_x
        self.dim_y = dim_y

    def draw(self, transform):

        self.factor = 100.0 / self.dim_x
        self.view_box_height = self.factor * self.dim_y
        line_width = self.factor * 0.5

        inv_transform = invert_transform(transform)

        box_origin = [0, self.page_height - self.dim_y]
        simpletransform.applyTransformToPoint(inv_transform, box_origin)

        box_dims = [self.dim_x, self.dim_y]
        length_inv_transform = [
            [inv_transform[0][0], inv_transform[0][1], 0.0],
            [inv_transform[1][0], inv_transform[1][1], 0.0]
        ]
        simpletransform.applyTransformToPoint(length_inv_transform, box_dims)

        self.area = inkex.etree.Element("svg", {
            'id': self.working_area_id,
            'x': str(self.to_uu(box_origin[0])),
            'y': str(self.to_uu(box_origin[1])),
            'width': str(self.to_uu(box_dims[0])),
            'height': str(self.to_uu(box_dims[1])),
            'viewBox': "0 0 100 " + str(self.view_box_height),
            'preserveAspectRatio': "none",
            'style': "fill:none;stroke-width:{};stroke:rgb(0,0,0)".format(line_width)})

    def draw_rectangle(self):

        inkex.etree.SubElement(self.area, "rect", {
            'x': "0",
            'y': "0",
            'width': "100",
            'height': str(self.view_box_height)})

    def draw_cross(self):

        cross_size = self.factor * 20
        cross_half_size = cross_size / 2
        cross_starth = -cross_half_size
        cross_endh = cross_half_size
        cross_startv = self.view_box_height - cross_half_size
        cross_endv = self.view_box_height + cross_half_size
        inkex.etree.SubElement(self.area, "path", {
            'd': "M {starth},{h} L {endh},{h} M 0,{startv} L 0,{endv}"
                 .format(h=self.view_box_height, starth=cross_starth, endh=cross_endh,
                         startv=cross_startv, endv=cross_endv)})

    def draw_text(self):

        text_size = self.factor * 10
        text_width = self.factor * 28
        text_height = self.factor * 10
        text = inkex.etree.SubElement(self.area, "text", {
            'x': str(-text_width),
            'y': str(self.view_box_height + text_height),
            'font-family': "Verdana",
            'font-size': str(text_size)})
        text.text = "(0, 0)"

    def upsert(self, layer):

        if self.area is None:
            transform = simpletransform.parseTransform(layer.get("transform"))
            self.draw(transform)

        old_working_area_elements = layer.xpath("*[@id = \"" + self.working_area_id + "\"]")
        for old in old_working_area_elements:
            old.getparent().remove(old)

        layer.append(self.area)

    def get_element(self):

        return self.area

    def get_dim_x(self):

        return self.dim_x

    def get_dim_y(self):

        return self.dim_y

    def get_factor(self):

        return self.factor

def normalize(angle):

    normalized = math.fmod(angle, math.pi)
    if normalized < 0.0:
        normalized += math.pi
    return normalized

def compute_tool_angle_for_direction(direction): 

    angle = math.atan2(direction[1], direction[0])
    return normalize(angle + math.pi/2.0)

class ToolAngleGenerator(object):

    def __init__(self):

        self.current_turn = 0

        self.prev_angle = None

        self.prev_dir = None

    def next_angle(self, direction):

        angle = None
        if self.prev_dir is None:
            angle = compute_tool_angle_for_direction(direction)
        else:
            angle = self.compute_next_tool_angle(direction)

        self.prev_angle = angle
        self.prev_dir = direction

        return angle + math.pi * self.current_turn

    def compute_next_tool_angle(self, direction):

        angle = compute_tool_angle_for_direction(direction)

        cross = self.prev_dir[0]*direction[1] - self.prev_dir[1]*direction[0]

        if cross > 0:

            if angle < self.prev_angle:
                self.current_turn += 1
        elif cross < 0:

            if angle > self.prev_angle:
                self.current_turn -= 1
        else:

            angle = self.prev_angle

        return angle

def discretize_path(path, discretization_step):

    def point_for_step(start, versor, step_length, step):

        return [start[0] + versor[0] * step_length * step,
                start[1] + versor[1] * step_length * step]

    if discretization_step == float('inf') or len(path) < 2:
        return path

    prev_point = path[0]
    discretized_path = [prev_point]
    for point in path[1:]:
        dist = distance(prev_point, point)
        if dist > discretization_step:

            versor = [(point[0] - prev_point[0]) / dist, (point[1] - prev_point[1]) / dist]
            num_steps = int(math.ceil(dist / discretization_step))
            step_length = dist / num_steps
            for i in range(1, num_steps):
                discretized_path.append(point_for_step(prev_point, versor, step_length, i))

        discretized_path.append(point)

        prev_point = point

    return discretized_path

class PointAndDirection(object): 

    def __init__(self, point, next_point, min_distance):

        self.point = (point[0], point[1])
        vector = [next_point[0] - point[0], next_point[1] - point[1]]
        vector_length = length(vector)
        if vector_length < min_distance:
            self.direction = (0.0, 0.0)
        else:
            self.direction = (vector[0] / vector_length, vector[1] / vector_length)

class CuttingToolPathsGenerator(object):

    def __init__(self, input_path, close_distance, border=None):

        verify_path_closed(input_path, close_distance)

        self.input_path = input_path
        self.border = border
        self.tool_path = None

    def generate(self):

        if not self.input_path:
            self.tool_path = None
            return

        bottom_left = self.get_bottom_left()

        self.add_initial_points()

        start_point = point_path_squared_distance(bottom_left, self.input_path)[1]
        self.tool_path += rotate_closed_path(self.input_path, start_point)

        self.add_final_points()

    def get_bottom_left(self):

        return self.border.bottom_left() if self.border else (0, 0)

    def add_initial_points(self):

        self.tool_path = [(0, 0)]

        if self.border:
            self.add_bottom_left_border_if_not_origin()

    def add_final_points(self):

        if self.border:

            self.tool_path.append(self.border.bottom_left())
            self.tool_path.append(self.border.bottom_right())
            self.tool_path.append(self.border.top_right())
            self.tool_path.append(self.border.top_left())
            self.add_bottom_left_border_if_not_origin()

        self.tool_path.append((0, 0))

    def add_bottom_left_border_if_not_origin(self): 

        if self.border.bottom_left() != (0, 0):
            self.tool_path.append(self.border.bottom_left())

    def path(self):

        return self.tool_path

class PathStatistics(object):

    def __init__(self, path, width, height, speed):

        self.path = path
        self.width = width
        self.height = height
        self.speed = speed

        self.path_inside_workpiece = None
        self.working_time = None

    def is_path_inside_workpiece(self):

        if self.path_inside_workpiece is None:
            self.path_inside_workpiece = True

            for (point_x, point_y) in self.path:
                if point_y > self.height or point_y < 0 or point_x > self.width or point_x < 0:
                    self.path_inside_workpiece = False

        return self.path_inside_workpiece

    def working_time_min(self):

        if self.working_time is None:
            self.working_time = 0

            if self.speed != 0:
                length = 0
                if self.path:
                    prev_point = self.path[0]
                    for point in self.path[1:]:
                        length += distance(prev_point, point)
                        prev_point = point

                self.working_time = int(math.ceil(length / self.speed))

        return self.working_time

class Border(object):

    def __init__(self, paths, margin):

        def join_aabb(first, second):

            return (min(first[0], second[0]),
                    max(first[1], second[1]),
                    min(first[2], second[2]),
                    max(first[3], second[3]))

        def find_aabb_of_path(path):

            (first_x, first_y) = path[0]
            aabb = (first_x, first_x, first_y, first_y)

            for (x, y) in path[1:]: 
                aabb = join_aabb(aabb, (x, x, y, y))

            return aabb

        self.x_min = 0
        self.x_max = 0
        self.y_min = 0
        self.y_max = 0

        aabb = None

        for path in paths:
            if path:
                if aabb:
                    aabb = join_aabb(aabb, find_aabb_of_path(path))
                else:
                    aabb = find_aabb_of_path(path)

        if aabb:
            self.x_min = aabb[0] - margin
            self.x_max = aabb[1] + margin
            self.y_min = aabb[2] - margin
            self.y_max = aabb[3] + margin

    def width(self):

        return self.x_max - self.x_min

    def height(self):

        return self.y_max - self.y_min

    def left(self):

        return self.x_min

    def right(self):

        return self.x_max

    def top(self):

        return self.y_max

    def bottom(self):

        return self.y_min

    def bottom_left(self):

        return (self.x_min, self.y_min)

    def bottom_right(self):

        return (self.x_max, self.y_min)

    def top_right(self):

        return (self.x_max, self.y_max)

    def top_left(self):

        return (self.x_min, self.y_max)

class BorderPainter(object):

    def __init__(self, border):

        self.border = border
        self.working_area = None

    def paint(self, working_area):

        self.working_area = working_area

        if self.border_is_to_be_drawn():
            border_x = self.working_area.get_factor() * self.border.left()

            border_y = self.working_area.get_factor() * (self.working_area.get_dim_y() -
                                                         self.border.top())
            border_width = self.working_area.get_factor() * self.border.width()
            border_height = self.working_area.get_factor() * self.border.height()
            line_width = self.working_area.get_factor() * 0.25
            etree.SubElement(self.working_area.get_element(), "rect", {
                'x': str(border_x),
                'y': str(border_y),
                'width': str(border_width),
                'height': str(border_height),
                'style': ("stroke-width:{};stroke-miterlimit:4;stroke-dasharray:0.25,0.25;"
                          "stroke-dashoffset:0").format(line_width)})

    def border_is_to_be_drawn(self):

        return self.border and (
            self.border.left() != 0 or
            self.border.right() != self.working_area.get_dim_x() or
            self.border.top() != self.working_area.get_dim_y() or
            self.border.bottom() != 0
        )

def compute_paths_distance(path1, path2):

    index_path1 = 0
    (paths_distance, index_path2) = point_path_squared_distance(path1[index_path1], path2)

    for (idx1, point) in zip(count(1), path1[1:]):
        (distance, idx2) = point_path_squared_distance(point, path2)
        if distance < paths_distance:
            paths_distance = distance
            index_path1 = idx1
            index_path2 = idx2

    return (paths_distance, index_path1, index_path2)

class PathsJoiner(object):

    def __init__(self, input_paths, close_distance):

        for path in input_paths:
            verify_path_closed(path, close_distance)

        self.input_paths = input_paths
        self.remaining_paths = []
        self.path = []

    def unite(self):

        if not self.input_paths:
            return
        else:
            self.path = self.input_paths[0]
            self.remaining_paths = self.input_paths[1:]

            nearest_path_info = self.extract_nearest_path()
            while nearest_path_info:
                (path, idx1, idx2) = nearest_path_info
                self.join_two_paths(path, idx1, idx2)
                nearest_path_info = self.extract_nearest_path()

    def join_two_paths(self, path_to_add, index_path, index_path_to_add):

        rotated_path = rotate_closed_path(path_to_add, index_path_to_add)
        self.path = self.path[:(index_path + 1)] + rotated_path + self.path[index_path:]

    def extract_nearest_path(self):

        if not self.remaining_paths:
            return None

        path_index = 0
        (path_distance, index_path, index_other_path) = compute_paths_distance(
            self.path,
            self.remaining_paths[0])

        for (path_idx, path) in zip(count(1), self.remaining_paths[1:]):
            (dist, idx1, idx2) = compute_paths_distance(self.path, path)
            if dist < path_distance:
                path_distance = dist
                index_path = idx1
                index_other_path = idx2
                path_index = path_idx

        path_to_return = self.remaining_paths.pop(path_index)

        return (path_to_return, index_path, index_other_path)

    def union_path(self):

        return self.path

if __name__ == '__main__':
    try:
        e = EcoCut2D() 
        e.affect()
    except EcoCutError as error:
        inkex.errormsg(error.to_string())
        exit(error.exit_code())