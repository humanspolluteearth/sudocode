class Cat:
    def __init__(self, name):
        self.name = name

    def rename(self, new):
        self.name = new


c = Cat("Tom")
c.rename("Kit")
print(c.name)
c.rename("a", "b")
