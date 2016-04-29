A mapping of Australian postcodes to federal electorates according to the Australian Electoral Commission.

The `redistributedElectorate` column of the data is the electorate which will be used at the next federal electorate for the given locality. For states where there was no redistribution the column will be blank.

To get a consolidated list of electorate/postcode mappings for the *next* election:

```
select distinct state, suburb, postcode, coalesce(nullif(redistributedElectorate,""), electorate) as electorate from data
```

Pull requests welcome.

This is a scraper that runs on [Morph](https://morph.io). To get started [see the documentation](https://morph.io/documentation).
