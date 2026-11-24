s = "  Hello World  "
print(s.upper(), s.lower(), s.strip(), s.lstrip(), s.rstrip() + "|", "xxhixx".strip("x"))
print("a,b,,c".split(","), "a b  c".split(), "a,b,c".split(",", 1), ",".join(["x", "y"]), "".join(["a", "b"]), "-".join("abc"))
print("hello".find("l"), "hello".find("z"), "hello".index("e"), "hello".replace("l", "L"), "hello".replace("l", "L", 1), "banana".count("an"), "banana".count("a"))
print("hello".startswith("he"), "hello".endswith("lo"), "123".isdigit(), "12a".isdigit(), "abc".isalpha(), "ab1".isalnum(), "AB".isupper(), "ab".islower(), "".isdigit())
print("{} is {}".format("x", 5), "{0}{1}{0}".format("a", "b"), "{:>5}|{:.2f}|{:<4}|".format("r", 3.14159, "l"), "{name}!".format(name="Z"), "Hello".capitalize(), "hello world".title())
try:
    "hello".index("z")
except ValueError as e:
    print(e)
