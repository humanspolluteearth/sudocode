class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "..."

    def describe(self):
        return self.name + " says " + self.speak()


class Dog(Animal):
    def speak(self):
        return "Woof"


class Puppy(Dog):
    def __init__(self, name, toy):
        super().__init__(name)
        self.toy = toy

    def speak(self):
        return super().speak() + "!"

    def play(self):
        return self.name + " plays with " + self.toy


class Cat(Animal):
    def __init__(self, name, lives=9):
        super().__init__(name)
        self.lives = lives

    def speak(self):
        return "Meow"


pets = [Animal("Thing"), Dog("Rex"), Puppy("Bit", "ball"), Cat("Tom")]
for p in pets:
    print(p.describe())
print(pets[2].play(), pets[3].lives)
print(isinstance(pets[2], Puppy), isinstance(pets[2], Dog), isinstance(pets[2], Animal), isinstance(pets[2], Cat))
print(isinstance(pets[0], Dog))
print(isinstance(pets[1], (Cat, Dog)))
print(type(pets[2]) == Puppy, type(pets[2]) == Dog)
print(issubclass(Puppy, Animal))
