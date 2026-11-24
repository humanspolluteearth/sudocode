# a comment
def f():
    """Doc string."""
    return 1  # trailing
print(f()) # more
print(f.__doc__)
"""module-level string statement"""
print("#not a comment")
