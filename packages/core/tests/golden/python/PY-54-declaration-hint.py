class Plain:
    def __init__(self, size):
        self.size = size


class Declared:
    # size: int
    # label: str
    def __init__(self, size):
        self.size = size
        self.label = "x"


class NoAttributes:
    def hello(self):
        return "hi"


print(Plain(2).size, Declared(3).label, NoAttributes().hello())
