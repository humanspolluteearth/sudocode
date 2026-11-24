def add(a, b=10):
    return a + b
def greet(name, greeting="Hello", punct="!"):
    return greeting + ", " + name + punct
def noreturn():
    pass
total = 0
def bump():
    global total
    total += 1
def fact(n):
    return 1 if n <= 1 else n * fact(n - 1)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
print(add(1), add(1, 2), add(b=1, a=5), greet("Ann"), greet("Bo", punct="?"), greet(greeting="Hi", name="Cy"))
print(noreturn())
bump(); bump()
print(total, fact(20), fact(30), fib(15))
f = add
print(f(2, 3), (lambda x, y=1: x * y)(6), sorted(["bb", "a", "ccc"], key=lambda s: -len(s)))
def outer():
    x = 5
    def inner():
        return x + 1
    return inner()
print(outer())
