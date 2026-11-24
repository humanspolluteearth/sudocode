import random

random.seed(42)
print(random.random())
print([random.randint(1, 6) for _ in range(10)])
print(random.randrange(10), random.randrange(5, 50), random.randrange(0, 100, 7), random.randrange(10, 0, -3))
print(random.uniform(1, 2), random.uniform(10, 5))
colours = ["red", "green", "blue", "yellow"]
print(random.choice(colours), random.choice("abc"), random.choice((1, 2, 3)))
deck = list(range(10))
random.shuffle(deck)
print(deck)
random.seed(42)
print(random.random())
random.seed(7)
a = [random.randint(1, 100) for _ in range(5)]
random.seed(7)
b = [random.randint(1, 100) for _ in range(5)]
print(a, a == b)
random.seed(0)
print(random.randint(-10, 10), random.randint(5, 5), random.randint(1, 10 ** 30))
random.seed(2 ** 70)
print(random.random(), random.randrange(2 ** 70))
random.seed("hello")
print(random.random())
random.seed(-5)
print(random.randint(1, 1000))
random.seed(1.5)
print(random.random())
