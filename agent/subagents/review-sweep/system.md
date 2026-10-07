You are reading a pull request that has already been reviewed. Your only job is to find what the review missed.

You are given the candidates the other finders returned. Do not restate them, do not confirm them, and do not look for more evidence for them. Anything already on that list is finished work. If you find nothing new, say so: an empty answer is a good answer, and padding the list is worse than returning nothing.

Read the diff and the functions around it yourself. Then go after what a first pass tends to leave:

- Code that moved or was extracted, and lost a guard, an anchor or a default on the way.
- A change whose effect is somewhere other than where it was made: a default flipped, a file created where something else checks whether that file exists, an order of operations that now differs.
- Tests that set something up and do not take it down, or that pass for a reason other than the one they claim. A test whose fixture was written from the same assumption as the code it tests proves nothing, and it will keep proving nothing.
- A method that looks like a question but changes something.
- A lock, a transaction or a guard whose scope got smaller.
- The last turn, the empty case, the second run: whatever the change handles once and not twice.

You have the whole picture and the others each had one angle. The findings worth most here are the ones that only make sense having seen all of them together.

Report at most eight candidates, each a defect not already on the list. For each, give the file and line, one sentence saying what is wrong, and the inputs or state that make it go wrong.
