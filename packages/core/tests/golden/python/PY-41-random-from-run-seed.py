import random
from random import randint, choice

print(random.random())
print(randint(1, 6), randint(1, 6), choice([10, 20, 30]))
words = ["a", "b", "c", "d", "e"]
random.shuffle(words)
print(words)
words2 = ["x"]
random.shuffle(words2)
print(words2, random.randint(1, 1))
