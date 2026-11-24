with open("out.txt", "w") as f:
    f.write("kept")
    raise ValueError("boom")
print("not reached")
