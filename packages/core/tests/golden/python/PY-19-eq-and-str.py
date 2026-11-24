class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return isinstance(other, Point) and self.x == other.x and self.y == other.y

    def __str__(self):
        return "(" + str(self.x) + ", " + str(self.y) + ")"


a = Point(1, 2)
b = Point(1, 2)
c = Point(3, 4)
print(a == b, a == c, a != c, a is b, a == 5)
print(a, c)
items = [a, c]
print(b in items, Point(9, 9) in items)
print(str(a) + "!")
