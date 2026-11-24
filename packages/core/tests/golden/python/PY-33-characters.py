print(ord("A"), ord("a"), ord("0"), chr(65), chr(97), chr(ord("a") + 1), chr(8364), ord("€"))
print("".join(chr(ord(c) + 1) for c in "HAL"))
