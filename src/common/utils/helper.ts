const dateFromString = async (value: string) => {
  const date = new Date(value)

  if (isNaN(date?.getTime())) {
    return false
  }

  return date
}

export { dateFromString }
