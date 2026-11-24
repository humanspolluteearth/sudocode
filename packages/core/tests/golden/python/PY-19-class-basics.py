class Dog:
    # name: str
    # age: int
    count = 0

    def __init__(self, name, age=1):
        self.name = name
        self.age = age
        Dog.count += 1

    def birthday(self):
        self.age += 1
        return self.age

    def get_name(self):
        return self.name

    def set_name(self, new_name):
        self.name = new_name

    def __str__(self):
        return self.name + " (" + str(self.age) + ")"

    def __repr__(self):
        return "Dog(" + repr(self.name) + ", " + str(self.age) + ")"


rex = Dog("Rex", 3)
fido = Dog("Fido")
print(rex)
print(str(fido), repr(fido))
print(rex.birthday(), rex.age)
rex.set_name("Max")
print(rex.get_name())
print([rex, fido])
print(f"{rex} and {fido!r}")
print(Dog.count, rex.count)
rex.age = 10
print(rex.age)
rex.colour = "brown"
print(rex.colour)
print(type(rex).__name__)
print(isinstance(rex, Dog), isinstance(5, Dog))
