import random
for call in [lambda: random.randint(5, 1), lambda: random.randrange(0), lambda: random.randrange(5, 5), lambda: random.randrange(1, 10, 0), lambda: random.choice([]), lambda: random.randint(1, 2.5)]:
    try:
        call()
    except Exception as e:
        print(type(e).__name__ + ":", e)
random.choice([])
