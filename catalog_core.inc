// Strict CSV reader: quoted commas, escaped quotes and multiline fields.
static std::vector<std::vector<std::string>> readCSV(const std::string& input) {
    std::vector<std::vector<std::string>> rows;std::vector<std::string> row;std::string cell;bool quoted=false,closed=false;
    size_t start=input.rfind("\xEF\xBB\xBF",0)==0?3:0;
    for(size_t i=start;i<input.size();i++){char c=input[i];if(quoted){if(c=='"'){if(i+1<input.size()&&input[i+1]=='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
        else if(c==','||c=='\n'||c=='\r'){row.push_back(trim(cell));cell.clear();closed=false;if(c!=','){if(c=='\r'&&i+1<input.size()&&input[i+1]=='\n')i++;if(row.size()!=1||!row[0].empty())rows.push_back(row);row.clear();}}
        else if(c=='"'){if(!cell.empty()||closed)throw std::runtime_error("Unexpected quote in CSV.");quoted=true;}
        else{if(closed&&c!=' '&&c!='\t')throw std::runtime_error("Unexpected text after CSV quote.");cell+=c;}}
    if(quoted)throw std::runtime_error("Unclosed CSV quote.");if(!cell.empty()||!row.empty()||closed){row.push_back(trim(cell));rows.push_back(row);}return rows;
}
